class_name RekordboxPage
extends VBoxContainer
# Shared by Settings and Source. Addresses stay in memory, never in saved settings.

signal port_changed(port: int)
signal location_changed(same_computer: bool)

var receiver: Rekordbox
var same_computer := false
var addresses: Array[Dictionary] = []
var _address: OptionButton
var _port: SpinBox
var _config: TextEdit
var _status: Label
var _help: Label
var _notice: Label
var _save: FileDialog
var _location: OptionButton
var _firewall := ""
var _copy: Button
var _copy_all: Button
var _save_button: Button

static func candidates(interfaces: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for interface in interfaces:
		var name: String = str(interface.get("name", "")).to_lower()
		var virtual := false
		for prefix in ["lo", "docker", "br-", "veth", "virbr", "tun", "tap", "utun", "wg", "tailscale", "zt", "vmnet", "vbox", "ham", "ppp"]:
			if name.begins_with(prefix): virtual = true
		for word in ["vpn", "virtual", "hyper-v", "wsl", "docker", "loopback"]:
			if word in (name + str(interface.get("friendly", "")).to_lower()): virtual = true
		if virtual: continue
		for raw in interface.get("addresses", []):
			var address := str(raw)
			if not address.is_valid_ip_address() or ":" in address: continue
			var first := int(address.get_slice(".", 0))
			if first == 0 or first == 127 or first >= 224 or address.begins_with("169.254."): continue
			var private_ip := first == 10 or address.begins_with("192.168.") or (first == 172 and int(address.get_slice(".", 1)) in range(16, 32))
			result.append({"ip": address, "name": str(interface.get("friendly", interface.get("name", "Network"))), "score": (-2 if interface.get("default", false) else 0) + (0 if private_ip else 1), "network": interface.get("networks", {}).get(address, ""), "zone": interface.get("zone", "")})
	result.sort_custom(func(a: Dictionary, b: Dictionary): return a.ip.naturalnocasecmp_to(b.ip) < 0 if a.score == b.score else a.score < b.score)
	return result

static func network(ip: String, prefix: int) -> String:
	if not ip.is_valid_ip_address() or ":" in ip or prefix < 0 or prefix > 32: return ""
	var value := 0
	for part in ip.split("."): value = (value << 8) | int(part)
	var mask := (0xffffffff << (32 - prefix)) & 0xffffffff
	value &= mask
	return "%d.%d.%d.%d/%d" % [(value >> 24) & 255, (value >> 16) & 255, (value >> 8) & 255, value & 255, prefix]

static func config_text(ip: String, port: int) -> String:
	return "keeper.keep_warm true\nosc.enabled true\nosc.source 0.0.0.0:4450\nosc.destination %s:%d\nosc.phrase_output_format string\nosc.msg.master/time true\nosc.msg.master/phrase true\nosc.msg.master/beat/subdiv 1\nosc.msg.n/time true\nosc.msg.n/phrase true\nosc.msg.n/beat/subdiv 1\n" % [ip, port]

static func firewall_help(system: String, firewall: String, subnet: String, port: int, zone := "") -> String:
	if system == "macOS":
		return "Allow incoming connections when macOS asks about SV.\nSystem Settings → Network → Firewall → Options → allow SV."
	if system == "Windows":
		return 'Allow SV on Private networks in Windows Defender Firewall.\nOr run in an Administrator terminal:\nnetsh advfirewall firewall add rule name="SV OSC" dir=in action=allow protocol=UDP localport=%d remoteip=LocalSubnet profile=private' % port
	if subnet == "": return "Could not read the network mask. Allow incoming UDP %d from your local network in your firewall settings." % port
	if firewall == "ufw": return "Run this yourself in a terminal:\nsudo ufw allow from %s to any port %d proto udp" % [subnet, port]
	if firewall == "firewalld":
		var rule := "rule family=ipv4 source address=%s port port=%d protocol=udp accept" % [subnet, port]
		var scope := " --zone=" + zone if zone != "" else ""
		return "Run these yourself in a terminal (%s zone):\nsudo firewall-cmd%s --add-rich-rule='%s'\nsudo firewall-cmd%s --permanent --add-rich-rule='%s'" % [zone if zone != "" else "default", scope, rule, scope, rule]
	return "No active ufw or firewalld detected. If you use a firewall, allow UDP %d from %s." % [port, subnet]

static func connection_text(state: Dictionary) -> String:
	if state.get("error", "") != "": return state.error
	if state.get("packets", 0) == 0: return "Waiting… nothing arrived yet."
	var age := "%.1f s ago" % state.seconds_since
	if not state.connected: return "Waiting… last received from %s · %s" % [state.sender_ip, age]
	var playing: Variant = state.get("playing")
	var activity := "playing" if playing == true else "stopped" if playing == false else "timing received"
	var title: String = state.get("title", "")
	return "✓ Receiving from %s · %s %s · %s\nLast packet %s" % [state.sender_ip, "Master deck" if state.deck == "master" else "Deck " + state.deck, activity, title if title != "" else "No title yet", age]

func _ready() -> void:
	add_theme_constant_override("separation", 12)
	_location = OptionButton.new()
	_location.add_item("This computer")
	_location.add_item("Another computer")
	_location.select(0 if same_computer else 1)
	add_child(UiStyle.label("Where does rekordbox run?"))
	add_child(_location)
	_location.item_selected.connect(func(index: int):
		same_computer = index == 0
		location_changed.emit(same_computer)
		_refresh())
	add_child(UiStyle.label("1 · SV listens on", "Subtitle"))
	var row := HBoxContainer.new()
	add_child(row)
	_address = OptionButton.new()
	_address.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_address)
	_port = SpinBox.new()
	_port.min_value = 1
	_port.max_value = 65535
	_port.value = receiver.port if receiver else 4460
	row.add_child(_port)
	var copy := UiStyle.button("Copy")
	_copy = copy
	row.add_child(copy)
	copy.pressed.connect(func(): DisplayServer.clipboard_set(destination()))
	_address.item_selected.connect(func(_i: int): _refresh())
	_port.value_changed.connect(func(value: float):
		port_changed.emit(int(value))
		_refresh())
	add_child(_text("Use the same network / Wi-Fi as the rekordbox computer."))
	add_child(UiStyle.label("Connection", "Subtitle"))
	_status = _text("")
	add_child(_status)
	add_child(UiStyle.label("2 · Put this in rkbx_link's config", "Subtitle"))
	_config = TextEdit.new()
	_config.editable = false
	_config.custom_minimum_size.y = 110
	_config.add_theme_color_override("font_readonly_color", UiStyle.TEXT)
	_config.add_theme_font_size_override("font_size", 20)
	add_child(_config)
	add_child(_text("Merge into the existing config. Choose keeper.rekordbox_version\nand keeper.decks there. Save the file, then restart rkbx_link."))
	var buttons := HBoxContainer.new()
	add_child(buttons)
	var copy_all := UiStyle.button("Copy all")
	_copy_all = copy_all
	buttons.add_child(copy_all)
	copy_all.pressed.connect(func(): DisplayServer.clipboard_set(_config.text))
	var save := UiStyle.button("Save as file")
	_save_button = save
	buttons.add_child(save)
	_save = FileDialog.new()
	_save.theme = UiStyle.theme()
	_save.access = FileDialog.ACCESS_FILESYSTEM
	_save.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	_save.current_file = "sv-osc-config.txt"
	add_child(_save)
	save.pressed.connect(func(): _save.popup_centered_ratio(0.7))
	_save.file_selected.connect(save_config)
	_notice = _text("")
	add_child(_notice)
	var help_toggle := UiStyle.button("Not working?")
	add_child(help_toggle)
	_help = _text("")
	_help.hide()
	add_child(_help)
	help_toggle.pressed.connect(func(): _help.visible = not _help.visible)
	var refresh := UiStyle.button("Refresh network addresses")
	add_child(refresh)
	refresh.pressed.connect(refresh_addresses)
	refresh_addresses()

func _text(text: String) -> Label:
	var label := UiStyle.label(text, "Hint")
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size.x = 680
	return label

func refresh_addresses() -> void:
	_firewall = ""
	var interfaces := IP.get_local_interfaces()
	if OS.get_name() == "Linux":
		var output := []
		if OS.execute("ip", ["-j", "-4", "address", "show", "up"], output) == 0:
			var parsed: Variant = JSON.parse_string("".join(output))
			if parsed is Array:
				interfaces = []
				for item in parsed:
					var entry := {"name": item.ifname, "addresses": [], "networks": {}}
					for info in item.get("addr_info", []):
						entry.addresses.append(info.local)
						entry.networks[info.local] = network(info.local, int(info.prefixlen))
					interfaces.append(entry)
		var route_output := []
		if OS.execute("ip", ["-j", "-4", "route", "show", "default"], route_output) == 0:
			var routes: Variant = JSON.parse_string("".join(route_output))
			if routes is Array and not routes.is_empty():
				routes.sort_custom(func(a: Dictionary, b: Dictionary): return int(a.get("metric", 0)) < int(b.get("metric", 0)))
				for interface in interfaces: interface["default"] = interface.name == routes[0].get("dev", "")
		var ignored := []
		if FileAccess.file_exists("/usr/sbin/ufw") and OS.execute("/usr/sbin/ufw", ["status"], ignored, true) == 0 and "Status: active" in "".join(ignored): _firewall = "ufw"
		# ufw status often requires root; installed ufw still has a usable rule command.
		elif FileAccess.file_exists("/usr/sbin/ufw"): _firewall = "ufw"
		ignored.clear()
		if OS.execute("systemctl", ["is-active", "firewalld"], ignored) == 0:
			_firewall = "firewalld"
			for interface in interfaces:
				var zones := []
				OS.execute("firewall-cmd", ["--get-zone-of-interface=" + str(interface.name)], zones)
				var zone := "".join(zones).strip_edges()
				if zone == "" or zone == "no zone":
					zones.clear()
					OS.execute("firewall-cmd", ["--get-default-zone"], zones)
					zone = "".join(zones).strip_edges()
				var valid_zone := not zone.is_empty()
				for character in zone:
					if character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-": valid_zone = false
				if valid_zone: interface["zone"] = zone
	addresses = candidates(interfaces)
	_refresh()

func destination() -> String:
	return "%s:%d" % [_ip(), int(_port.value)]

func _ip() -> String:
	if same_computer: return "127.0.0.1"
	return addresses[maxi(0, _address.selected)].ip if not addresses.is_empty() else ""

func _refresh() -> void:
	var selected := _address.selected
	_address.clear()
	if same_computer: _address.add_item("127.0.0.1")
	else:
		for item in addresses: _address.add_item("%s · %s" % [item.ip, item.name])
		if addresses.is_empty(): _address.add_item("No LAN address. Connect to your network.")
	if selected >= 0 and selected < _address.item_count: _address.select(selected)
	_copy.disabled = _ip() == ""
	_copy_all.disabled = _ip() == ""
	_save_button.disabled = _ip() == ""
	_config.text = config_text(_ip(), int(_port.value)) if _ip() != "" else "Connect to your local network, then refresh addresses."
	var subnet := "" if addresses.is_empty() else str(addresses[maxi(0, _address.selected)].network)
	_help.text = "Both computers must use the same network.\nStart rkbx_link on the rekordbox computer.\nChoose its rekordbox version and deck count.\nPlay an analysed track in rekordbox.\n\n" + ("Local traffic uses 127.0.0.1." if same_computer else firewall_help(OS.get_name(), _firewall, subnet, int(_port.value), str(addresses[maxi(0, _address.selected)].get("zone", "")) if not addresses.is_empty() else ""))

func save_config(path: String) -> void:
	if _ip() == "":
		_notice.text = "Connect to your network first."
		return
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not file:
		_notice.text = "Could not save the file. Choose another folder."
		return
	file.store_string(_config.text)
	file.flush()
	_notice.text = "Saved. Merge these lines into rkbx_link's config." if file.get_error() == OK else "Could not write the file."

func _process(_dt: float) -> void:
	if is_visible_in_tree() and _status:
		_status.text = connection_text(receiver.status()) if is_instance_valid(receiver) else "Choose Rekordbox or Both in Source to start listening."

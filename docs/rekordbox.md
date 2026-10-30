# Rekordbox on this or another computer

1. In SV, open **Settings → Rekordbox**. From **Source**, choose Rekordbox or Both,
   then **Rekordbox connection…**.
2. Choose **This computer** if both apps run together. SV uses `127.0.0.1`.
   Choose **Another computer** if rekordbox runs elsewhere. Connect both to the same
   network. Choose the SV address on that network; SV lists physical IPv4 interfaces,
   with private addresses first and the default route first on Linux. VPN and virtual
   adapters are excluded by name. Unusually named virtual adapters may need manual checking.
3. Leave the port at **4460**, unless another app uses it. Changing it starts listening
   on the new port immediately. **Copy** copies the destination, for example `192.168.1.23:4460`.
4. On the rekordbox computer, download [rkbx_link](https://github.com/grufkork/rkbx_link).
   Use **Copy all**, or **Save as file** and transfer that text file. Merge these lines
   into rkbx_link's existing `config` next to its executable. The saved file is an OSC
   settings fragment; keep the other settings in the original config.
5. In that config, choose **keeper.rekordbox_version** yourself to match rekordbox.
   Choose **keeper.decks** to match the active deck count (usually 2). Restart rkbx_link
   after changing its config. SV cannot configure or start rkbx_link remotely.
6. Play an analysed track in rekordbox. **Connection** shows the sender, deck, title
   and time since the last accepted packet. With no playing flag, SV reports playback
   only after it observes the track position moving. “Master deck” means the upstream
   master stream; that stream does not identify the physical deck number. After 1.5 s
   without valid data, the page shows that it is waiting again.
7. Choose **Save** in Settings, or finish Source, to keep your choices. Back/Escape
   from Settings restores the saved port. Back from Source's connection page returns
   to its source check; cancelling Source restores the previous choices.

## If nothing arrives

Open **Not working?**. It shows help for the computer running SV. Check the same
network, rkbx_link, the version/deck choices and an analysed playing track first.
Guest Wi-Fi or client isolation can prevent computers from reaching one another.

On Linux, SV reads the selected interface's actual IPv4 prefix with `ip` and shows
an ufw or firewalld command restricted to that network. An installed ufw is detected
when its status cannot be read without root. Firewalld rules target the selected interface’s zone when it can be read, otherwise
the default zone. The command shows the zone explicitly when detected.
If SV cannot read a prefix, it asks you to allow the port in your firewall settings
instead of guessing a subnet. Run any displayed sudo commands yourself.

On macOS, allow SV's incoming connections. Go to **System Settings → Network →
Firewall → Options** to change this later. On Windows, allow SV on **Private networks**
in Defender Firewall, or run the shown `netsh` command in an Administrator terminal.
The Windows rule allows only LocalSubnet on the Private profile.

## Configuration reference

The [upstream config](https://github.com/grufkork/rkbx_link/blob/master/config) and
[OSC documentation](https://github.com/grufkork/rkbx_link#open-sound-control-osc)
define space-separated key/value lines. SV generates `osc.enabled true`, a wildcard
`osc.source 0.0.0.0:4450` for LAN output, the chosen `osc.destination`, and
`osc.phrase_output_format string`. It enables time, phrase and beat/subdiv 1 for
both `osc.msg.master/…` and `osc.msg.n/…`, with `keeper.keep_warm true` for other decks.
Track metadata and BPM have no separate message toggles. String phrases preserve
names such as “Up 1”; numeric phrase families lose that detail.

Firewall syntax: [ufw](https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html),
[firewalld](https://firewalld.org/documentation/man-pages/firewall-cmd.html),
[Windows netsh](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-advfirewall).

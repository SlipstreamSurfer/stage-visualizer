// Where the DJ's eyes are, for the camera that looks out through them (cameras.js, DJ view). The DJ figure (dj.js)
// sets it every frame; one DJ plays at a time. Plain numbers, so the cameras need nothing else to read it.
export const djEye = { x: 0, y: 0, z: 0, seen: false, inside: false };   // inside: the DJ view is on screen (main.js)

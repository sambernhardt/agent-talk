// All coordinates are global desktop coordinates, including negative monitor origins.
const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
function fit(bounds,area){
 const width=Math.min(bounds.width,area.width-24),height=Math.min(bounds.height,area.height-24);
 return {x:Math.round(clamp(bounds.x,area.x+12,area.x+area.width-width-12)),y:Math.round(clamp(bounds.y,area.y+12,area.y+area.height-height-12)),width:Math.round(width),height:Math.round(height)};
}
function attachedBounds(codex,area){
 // The transparent 16px top band fits around Codex's rounded corners.
 return {x:Math.round(codex.x),y:Math.round(codex.y+codex.height-16),width:Math.round(codex.width),height:80};
}
function hasChinRoom(bounds,area){return bounds.y>=area.y&&bounds.y+bounds.height<=area.y+area.height;}
function trayBounds(tray,area){return fit({x:tray.x+tray.width/2-210,y:tray.y+tray.height+8,width:420,height:600},area);}
module.exports={fit,attachedBounds,hasChinRoom,trayBounds};

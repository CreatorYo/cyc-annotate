function drawArrow(ctx, x1, y1, x2, y2) {
  const headlen = 15
  const angle = Math.atan2(y2 - y1, x2 - x1)
  
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

module.exports = {
  drawArrow
}

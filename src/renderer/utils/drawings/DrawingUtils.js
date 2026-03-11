function drawArrow(ctx, x1, y1, x2, y2) {
  const headlen = ctx.lineWidth * 4 + 10
  const angle = Math.atan2(y2 - y1, x2 - x1)
  
  const dx = x2 - x1
  const dy = y2 - y1
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  let endX = x2
  let endY = y2
  
  if (distance > headlen) {
      const shortenAmount = headlen / 1.5
      const ratio = (distance - shortenAmount) / distance
      endX = x1 + dx * ratio
      endY = y1 + dy * ratio
  }

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(endX, endY)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 7), y2 - headlen * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 7), y2 - headlen * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fill()
}

module.exports = {
  drawArrow
}

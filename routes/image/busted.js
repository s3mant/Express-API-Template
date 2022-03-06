const Canvas = require("canvas");

exports.execute = async (req, res) => {
  const query = req.query.image;
  if (!query) return res.json({ error: "provide image" });

  const avatar = await Canvas.loadImage(query);
  let bg = await Canvas.loadImage(
    "https://github.com/katie07/Imagayes/blob/main/BOS.png?raw=true"
  );

  const canvas = Canvas.createCanvas(1000, 1000);
  const ctx = canvas.getContext(`2d`);

  ctx.drawImage(avatar, 0, 0, 1000, 1000);
  ctx.drawImage(bg, 0, 0, 1000, 1000);
  res.set({ "Content-Type": "image/png" });
  res.send(canvas.toBuffer());
};

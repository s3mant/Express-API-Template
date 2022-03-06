exports.execute = async (req, res) => {
  let text = req.query.text;
  if (!text) return res.send({ error: "please provide some text" });
  res.send({ text: text.toString().split("").reverse().join("") });
};

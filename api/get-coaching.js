module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { weeklyPercent, streak, weakestHabit } = req.body;

    const prompt = "I have these habit tracker stats this week: " +
      "Weekly completion: " + weeklyPercent + "%. " +
      "Current streak: " + streak + " days. " +
      "Weakest habit: " + weakestHabit + ". " +
      "Give me a coaching note following this format: " +
      "1. One honest sentence about my week. " +
      "2. One specific thing to fix based on my weakest habit. " +
      "3. One thing to protect that is already working. " +
      "4. One sentence connecting my habits to my goal of building an AI consulting firm. " +
      "Keep it under 100 words. Be direct, not cheesy.";

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      })
    });

    const data = await response.json();
    const coaching = data.choices[0].message.content;

    res.status(200).json({ coaching });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

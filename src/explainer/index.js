function explain(card, userAnswer) {
  return {
    explanation: `The correct answer is: "${card.back}"`,
    memoryTip: `${card.front.replace(/\?$/, '')} → ${card.back.split(/\s+/).slice(0, 8).join(' ')}`,
  };
}

module.exports = { explain };

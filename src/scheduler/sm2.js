function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function sm2(easeFactor, interval, repetitions, quality) {
  if (quality < 3) {
    return {
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      interval: 1,
      repetitions: 0,
      nextReviewDate: minutesFromNow(10), // lapsed card: retry in 10 minutes
    };
  }

  const newEF = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  const newInterval =
    repetitions === 0 ? 1 :
    repetitions === 1 ? 6 :
    Math.round(interval * newEF);

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: repetitions + 1,
    nextReviewDate: daysFromNow(newInterval),
  };
}

module.exports = { sm2 };

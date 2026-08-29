function normalcdf(mean, sigma, to) {
  var z = (to - mean) / Math.sqrt(2 * sigma * sigma);
  var t = 1 / (1 + 0.3275911 * Math.abs(z));
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;
  var erf =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  var sign = 1;
  if (z < 0) {
    sign = -1;
  }
  return (1 / 2) * (1 + sign * erf);
}

function calculateRank(params) {
  const COMMITS_OFFSET = 1.65;
  const CONTRIBS_OFFSET = 1.65;
  const ISSUES_OFFSET = 1;
  const STARS_OFFSET = 0.75;
  const PRS_OFFSET = 0.5;
  const FOLLOWERS_OFFSET = 0.45;
  const REPO_OFFSET = 1;

  const score =
    params.commits * COMMITS_OFFSET +
    params.contribs * CONTRIBS_OFFSET +
    params.issues * ISSUES_OFFSET +
    params.stars * STARS_OFFSET +
    params.prs * PRS_OFFSET +
    params.followers * FOLLOWERS_OFFSET +
    params.repos * REPO_OFFSET;

  const mean = 1000;
  const sigma = 400;
  const probability = normalcdf(mean, sigma, score);
  const normalizedScore = probability * 100;

  let level = '';
  if (normalizedScore >= 99) {
    level = 'S+';
  } else if (normalizedScore >= 95) {
    level = 'S';
  } else if (normalizedScore >= 85) {
    level = 'A++';
  } else if (normalizedScore >= 60) {
    level = 'A+';
  } else if (normalizedScore >= 45) {
    level = 'A';
  } else if (normalizedScore >= 35) {
    level = 'B+';
  } else if (normalizedScore >= 25) {
    level = 'B';
  } else {
    level = 'C';
  }

  return { level, score: normalizedScore };
}

module.exports = { calculateRank };

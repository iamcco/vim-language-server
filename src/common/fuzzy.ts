export default function fuzzy(origin: string, query: string): number {
  let score = 0;

  for (let qIdx = 0, oIdx = 0; qIdx < query.length && oIdx < origin.length; qIdx++) {
    const qc = query.charAt(qIdx).toLowerCase();

    for (; oIdx < origin.length; oIdx++) {
      const oc = origin.charAt(oIdx).toLowerCase();

      if (qc === oc) {
        score++;
        oIdx++;
        break;
      }
    }
  }

  return score;
};

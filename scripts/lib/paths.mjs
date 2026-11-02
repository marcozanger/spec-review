import { dirname, basename, join } from "node:path";

const stem = file => basename(file).replace(/\.(md|markdown)$/i, "");

export const notesPath = file => join(dirname(file), `${stem(file)}.review.json`);
export const htmlPath = file => join(dirname(file), `${stem(file)}.review.html`);

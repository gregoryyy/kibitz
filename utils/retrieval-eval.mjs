// Repository utility; app-specific, linted/type-checked implementation stays in site/eval/.
import { main } from '../site/eval/retrieval/report.mjs';
await main(process.argv.slice(2));

import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
// Resolve relative to the server rather than the shell's working directory.
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url))});

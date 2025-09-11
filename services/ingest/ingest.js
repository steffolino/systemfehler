#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var readline_1 = __importDefault(require("readline"));
var crypto_1 = require("crypto");
var dotenv_1 = __importDefault(require("dotenv"));
var pg_1 = __importDefault(require("pg"));
// services/ingest/ingest.ts
// Removed invalid type imports from @prisma/client
// example: a function shaped by DB types
// Removed formatBenefit function referencing missing Benefit type
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
var Client = pg_1.default.Client;
var DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/systemfehler';
function slugify(s) {
    if (s === void 0) { s = ''; }
    return s.toLowerCase()
        .normalize('NFKD').replace(/[^\w\s-]/g, '')
        .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}
var shash = function (s) { return (0, crypto_1.createHash)('sha1').update(s).digest('hex').slice(0, 12); };
var idFor = function (kind, title) { return "".concat(kind, ".").concat(slugify(title || 'unknown')); };
var rlId = function (kind, parentId, url) { return "rl.".concat(kind, ".").concat(shash(parentId + '|' + url)); };
function upsertBenefit(c, rec) {
    return __awaiter(this, void 0, void 0, function () {
        var id, title_de, title_en, summary_de, summary_en, topic, language, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = rec.id || idFor('benefit', rec.title_de || rec.title_en || rec.title);
                    title_de = rec.title_de || rec.title || '';
                    title_en = rec.title_en || '';
                    summary_de = rec.summary_de || '';
                    summary_en = rec.summary_en || '';
                    topic = Array.isArray(rec.topic) ? rec.topic : [rec.topic || ''];
                    language = Array.isArray(rec.language) ? rec.language : [rec.language || 'de'];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, c.query("\n      INSERT INTO \"Benefit\"(id, title_de, title_en, summary_de, summary_en, topic, language, \"createdAt\", \"updatedAt\")\n      VALUES ($1,$2,$3,$4,$5,$6::text[],$7::text[], now(), now())\n      ON CONFLICT (id) DO UPDATE SET\n        title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,\n        summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,\n        topic=EXCLUDED.topic, language=EXCLUDED.language, \"updatedAt\"=now()\n    ", [id, title_de, title_en, summary_de, summary_en, topic, language])];
                case 2:
                    _a.sent();
                    console.log("[Benefit] Upserted: ".concat(id));
                    return [4 /*yield*/, upsertLinks(c, 'benefit', id, rec.links || [])];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4:
                    e_1 = _a.sent();
                    console.warn("[Benefit] Failed: ".concat(id), e_1);
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function upsertTool(c, rec) {
    return __awaiter(this, void 0, void 0, function () {
        var id, title_de, title_en, summary_de, summary_en, url, category, language, topic, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = rec.id || idFor('tool', rec.title_de || rec.title_en || rec.title);
                    title_de = rec.title_de || rec.title || '';
                    title_en = rec.title_en || '';
                    summary_de = rec.summary_de || '';
                    summary_en = rec.summary_en || '';
                    url = rec.url || null;
                    category = rec.category || null;
                    language = Array.isArray(rec.language) ? rec.language : [rec.language || 'de'];
                    topic = Array.isArray(rec.topic) ? rec.topic : [rec.topic || ''];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, c.query("\n      INSERT INTO \"Tool\"(id, title_de, title_en, summary_de, summary_en, url, category, language, topic, \"createdAt\", \"updatedAt\")\n      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9::text[], now(), now())\n      ON CONFLICT (id) DO UPDATE SET\n        title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,\n        summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,\n        url=EXCLUDED.url, category=EXCLUDED.category,\n        language=EXCLUDED.language, topic=EXCLUDED.topic, \"updatedAt\"=now()\n    ", [id, title_de, title_en, summary_de, summary_en, url, category, language, topic])];
                case 2:
                    _a.sent();
                    console.log("[Tool] Upserted: ".concat(id));
                    return [4 /*yield*/, upsertLinks(c, 'tool', id, rec.links || [])];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4:
                    e_2 = _a.sent();
                    console.warn("[Tool] Failed: ".concat(id), e_2);
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function upsertAid(c, rec) {
    return __awaiter(this, void 0, void 0, function () {
        var id, title_de, title_en, summary_de, summary_en, organization, contact, region, language, topic, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = rec.id || idFor('aid', rec.title_de || rec.title_en || rec.title);
                    title_de = rec.title_de || rec.title || '';
                    title_en = rec.title_en || '';
                    summary_de = rec.summary_de || '';
                    summary_en = rec.summary_en || '';
                    organization = rec.organization || null;
                    contact = rec.contact || null;
                    region = rec.region || null;
                    language = Array.isArray(rec.language) ? rec.language : [rec.language || 'de'];
                    topic = Array.isArray(rec.topic) ? rec.topic : [rec.topic || ''];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, c.query("\n      INSERT INTO \"AidOffer\"(id, title_de, title_en, summary_de, summary_en, organization, contact, region, language, topic, \"createdAt\", \"updatedAt\")\n      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[], now(), now())\n      ON CONFLICT (id) DO UPDATE SET\n        title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,\n        summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,\n        organization=EXCLUDED.organization, contact=EXCLUDED.contact, region=EXCLUDED.region,\n        language=EXCLUDED.language, topic=EXCLUDED.topic, \"updatedAt\"=now()\n    ", [id, title_de, title_en, summary_de, summary_en, organization, contact, region, language, topic])];
                case 2:
                    _a.sent();
                    console.log("[AidOffer] Upserted: ".concat(id));
                    return [4 /*yield*/, upsertLinks(c, 'aid', id, rec.links || [])];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4:
                    e_3 = _a.sent();
                    console.warn("[AidOffer] Failed: ".concat(id), e_3);
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function upsertLinks(c, kind, parentId, links) {
    return __awaiter(this, void 0, void 0, function () {
        var fk, _i, links_1, l, id;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fk = kind === 'benefit' ? 'benefitId' : kind === 'tool' ? 'toolId' : 'aidOfferId';
                    _i = 0, links_1 = links;
                    _a.label = 1;
                case 1:
                    if (!(_i < links_1.length)) return [3 /*break*/, 4];
                    l = links_1[_i];
                    if (!(l === null || l === void 0 ? void 0 : l.url))
                        return [3 /*break*/, 3];
                    id = l.id || rlId(kind, parentId, l.url);
                    return [4 /*yield*/, c.query("\n      INSERT INTO \"RelatedLink\"(id, url, title, relation, \"proposedAsEntry\", status, \"".concat(fk, "\")\n      VALUES ($1,$2,$3,$4,$5,$6,$7)\n      ON CONFLICT (id) DO UPDATE SET\n        url=EXCLUDED.url, title=EXCLUDED.title, relation=EXCLUDED.relation,\n        \"proposedAsEntry\"=EXCLUDED.\"proposedAsEntry\", status=EXCLUDED.status, \"").concat(fk, "\"=EXCLUDED.\"").concat(fk, "\"\n    "), [
                            id, l.url, l.title || null, l.relation || null,
                            Boolean(l.proposedAsEntry) || false, l.status || 'pending',
                            parentId
                        ])];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function refreshMV(c) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, c.query("REFRESH MATERIALIZED VIEW CONCURRENTLY entries_mv;")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function ingestNdjsonFile(client, filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var rl, n, nBenefit, nTool, nAid, nSkipped, nDup, nInvalid, dryRun, seenIds, _a, rl_1, rl_1_1, line, s, rec, e_4_1;
        var _b, e_4, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    rl = readline_1.default.createInterface({ input: fs_1.default.createReadStream(filePath), crlfDelay: Infinity });
                    n = 0, nBenefit = 0, nTool = 0, nAid = 0, nSkipped = 0, nDup = 0, nInvalid = 0;
                    dryRun = process.argv.includes('--dry-run');
                    seenIds = new Set();
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 13, 14, 19]);
                    _a = true, rl_1 = __asyncValues(rl);
                    _e.label = 2;
                case 2: return [4 /*yield*/, rl_1.next()];
                case 3:
                    if (!(rl_1_1 = _e.sent(), _b = rl_1_1.done, !_b)) return [3 /*break*/, 12];
                    _d = rl_1_1.value;
                    _a = false;
                    line = _d;
                    s = line.trim();
                    if (!s)
                        return [3 /*break*/, 11];
                    rec = void 0;
                    try {
                        rec = JSON.parse(s);
                    }
                    catch (_f) {
                        console.warn('Skip bad JSON:', s);
                        nSkipped++;
                        nInvalid++;
                        return [3 /*break*/, 11];
                    }
                    if (!rec.kind) {
                        console.warn('Skip missing kind:', s);
                        nSkipped++;
                        nInvalid++;
                        return [3 /*break*/, 11];
                    }
                    // Pflichtfelder prüfen
                    if (!rec.id || (!rec.title && !rec.title_de && !rec.name)) {
                        console.warn('Skip missing id/title:', rec);
                        nSkipped++;
                        nInvalid++;
                        return [3 /*break*/, 11];
                    }
                    // Duplikate prüfen
                    if (seenIds.has(rec.id)) {
                        console.warn('Skip duplicate id:', rec.id);
                        nSkipped++;
                        nDup++;
                        return [3 /*break*/, 11];
                    }
                    seenIds.add(rec.id);
                    // Dry-Run: nur validieren, nicht schreiben
                    if (dryRun) {
                        n++;
                        return [3 /*break*/, 11];
                    }
                    if (!(rec.kind === 'benefit')) return [3 /*break*/, 5];
                    return [4 /*yield*/, upsertBenefit(client, rec)];
                case 4:
                    if (_e.sent())
                        nBenefit++;
                    else
                        nSkipped++;
                    return [3 /*break*/, 10];
                case 5:
                    if (!(rec.kind === 'tool')) return [3 /*break*/, 7];
                    return [4 /*yield*/, upsertTool(client, rec)];
                case 6:
                    if (_e.sent())
                        nTool++;
                    else
                        nSkipped++;
                    return [3 /*break*/, 10];
                case 7:
                    if (!(rec.kind === 'aid')) return [3 /*break*/, 9];
                    return [4 /*yield*/, upsertAid(client, rec)];
                case 8:
                    if (_e.sent())
                        nAid++;
                    else
                        nSkipped++;
                    return [3 /*break*/, 10];
                case 9:
                    console.warn('Unknown kind:', rec.kind);
                    nSkipped++;
                    nInvalid++;
                    return [3 /*break*/, 11];
                case 10:
                    n++;
                    _e.label = 11;
                case 11:
                    _a = true;
                    return [3 /*break*/, 2];
                case 12: return [3 /*break*/, 19];
                case 13:
                    e_4_1 = _e.sent();
                    e_4 = { error: e_4_1 };
                    return [3 /*break*/, 19];
                case 14:
                    _e.trys.push([14, , 17, 18]);
                    if (!(!_a && !_b && (_c = rl_1.return))) return [3 /*break*/, 16];
                    return [4 /*yield*/, _c.call(rl_1)];
                case 15:
                    _e.sent();
                    _e.label = 16;
                case 16: return [3 /*break*/, 18];
                case 17:
                    if (e_4) throw e_4.error;
                    return [7 /*endfinally*/];
                case 18: return [7 /*endfinally*/];
                case 19:
                    console.log("[Summary] Benefits: ".concat(nBenefit, ", Tools: ").concat(nTool, ", AidOffers: ").concat(nAid, ", Skipped: ").concat(nSkipped, ", Duplicates: ").concat(nDup, ", Invalid: ").concat(nInvalid));
                    return [2 /*return*/, n];
            }
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var args, pFile, pDir, refreshOnly, client, total, _a, files, _i, files_1, f, _b, e_5;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    args = process.argv.slice(2);
                    pFile = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null;
                    pDir = args.indexOf('--dir') >= 0 ? args[args.indexOf('--dir') + 1] : null;
                    refreshOnly = args.includes('--refresh-only');
                    client = new Client({ connectionString: DB_URL });
                    return [4 /*yield*/, client.connect()];
                case 1:
                    _c.sent();
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 16, 18, 20]);
                    if (!refreshOnly) return [3 /*break*/, 4];
                    return [4 /*yield*/, refreshMV(client)];
                case 3:
                    _c.sent();
                    console.log('REFRESH OK');
                    return [2 /*return*/];
                case 4: return [4 /*yield*/, client.query('BEGIN')];
                case 5:
                    _c.sent();
                    total = 0;
                    if (!pFile) return [3 /*break*/, 7];
                    if (!fs_1.default.existsSync(pFile)) {
                        console.error("File not found: ".concat(pFile));
                        process.exit(2);
                    }
                    _a = total;
                    return [4 /*yield*/, ingestNdjsonFile(client, path_1.default.resolve(pFile))];
                case 6:
                    total = _a + _c.sent();
                    return [3 /*break*/, 13];
                case 7:
                    if (!pDir) return [3 /*break*/, 12];
                    if (!fs_1.default.existsSync(pDir) || !fs_1.default.statSync(pDir).isDirectory()) {
                        console.error("Directory not found: ".concat(pDir));
                        process.exit(2);
                    }
                    files = fs_1.default.readdirSync(pDir).filter(function (f) { return f.endsWith('.ndjson'); });
                    if (files.length === 0) {
                        console.error("No .ndjson files found in directory: ".concat(pDir));
                        process.exit(2);
                    }
                    _i = 0, files_1 = files;
                    _c.label = 8;
                case 8:
                    if (!(_i < files_1.length)) return [3 /*break*/, 11];
                    f = files_1[_i];
                    _b = total;
                    return [4 /*yield*/, ingestNdjsonFile(client, path_1.default.join(pDir, f))];
                case 9:
                    total = _b + _c.sent();
                    _c.label = 10;
                case 10:
                    _i++;
                    return [3 /*break*/, 8];
                case 11: return [3 /*break*/, 13];
                case 12:
                    console.error('Usage: node ingest.js --file <path.ndjson> | --dir <folder>');
                    process.exit(2);
                    _c.label = 13;
                case 13: return [4 /*yield*/, client.query('COMMIT')];
                case 14:
                    _c.sent();
                    console.log("UPSERTS: ".concat(total));
                    return [4 /*yield*/, refreshMV(client)];
                case 15:
                    _c.sent();
                    console.log('REFRESH OK');
                    return [3 /*break*/, 20];
                case 16:
                    e_5 = _c.sent();
                    return [4 /*yield*/, client.query('ROLLBACK')];
                case 17:
                    _c.sent();
                    console.error(e_5);
                    process.exit(1);
                    return [3 /*break*/, 20];
                case 18: return [4 /*yield*/, client.end()];
                case 19:
                    _c.sent();
                    return [7 /*endfinally*/];
                case 20: return [2 /*return*/];
            }
        });
    });
}
run().catch(function (e) { console.error(e); process.exit(1); });

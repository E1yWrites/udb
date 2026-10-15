# Support matrix

Generated from `registry/devices/` by `npm run support`. **Do not edit by hand.**

Only `read-verified` and `write-verified` mean a result was observed on real hardware.
`experimental` comes from static analysis, documentation or replay. `unsupported` means the
device has the feature but UDB does not control it. `companion` features run on the PC and are
never shown as device controls.

## Mice

### Pulsar X2 CrazyLight Mini (Bruce Lee 85th Anniversary Edition)

Protocol: `compx` ([notes](docs/protocols/compx.md))

| Identity | Connection | Detected by UDB |
|---|---|---|
| `0x3710:0x5406` "Pulsar 8K Dongle" | dongle | Pulsar 8K Dongle bundled with X2 CrazyLight Bruce Lee edition; Microsoft Edge 155 on Windows 11 (ROG Zephyrus G14 GA403), 2026-10-15, high confidence |
| `0x3710:0x3414` "Pulsar X2 CrazyLight" | wired | Pulsar X2 CrazyLight Bruce Lee 85th Anniversary Edition, USB cable; Microsoft Edge 155 on Windows 11 (ROG Zephyrus G14 GA403), 2026-10-15, high confidence |

| Feature | Location | Status | Read-back | Latest evidence |
|---|---|---|---|---|
| polling-rate | device | write-verified | yes | no hardware, 2026-10-15, medium confidence |
| dpi.stages | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| dpi.current-stage | device | read-verified | yes | no hardware, 2026-10-15, medium confidence |
| lift-off-distance | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| debounce-ms | device | write-verified | yes | no hardware, 2026-10-15, medium confidence |
| battery | device | read-verified | yes | no hardware, 2026-10-15, medium confidence |

### Not yet seen on hardware by UDB (169)

| Device | USB IDs | Protocol | Experimental | Not supported |
|---|---|---|---|---|
| ATK A9 | 373B:1157 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 3.0 NK | 373B:1305 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Air | 373B:120A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Air + | 373B:127F 373B:1288 373B:1293 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK A9 Mini | 373B:1256 373B:125A 373B:1268 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Mini + | 373B:1251 373B:1269 373B:128E | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK A9 NB | 373B:1245 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 NB ULTRA | 373B:11F3 373B:12D0 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 NB ULTRA + | 373B:12AB | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK A9 NK | 373B:1116 373B:1223 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Plus 3.0 NK | 373B:1337 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Plus NK | 373B:1115 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Plus NK | 373B:1224 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Plus NK | 373B:1300 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Plus NK | 373B:1263 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Pro | 373B:112D | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Pro Max | 373B:1117 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Pro Max 2.0 NK | 373B:11DB | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Pro Max 2.0 NK | 373B:1301 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Pro Max 2.0 NK | 373B:1264 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 Pro Max 3.0 NK | 373B:1338 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 PRO MAX | 373B:1147 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 SE 3.0 NK | 373B:130F | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK A9 SE NK | 373B:1135 373B:1222 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultimate | 373B:11B6 373B:1314 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultimate 3.0 | 373B:1211 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultimate + | 373B:127E 373B:1287 373B:1292 373B:12F1 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK A9 Ultimate Silent | 373B:12B3 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK A9 Ultra | 373B:1119 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultra Max 2.0 | 373B:11DD | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultra Max 2.0 | 373B:126F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultra Max 2.0 + | 373B:128F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultra Max 2.0 Tri-Mode | 373B:11F2 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Ultra Max 2.0 Tri-Mode | 373B:1270 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK A9 Wireless Charging | 373B:12C6 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK A9 X | 373B:11A0 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly Dragonfly F1S | 3554:F50A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly F1 MOBA | 3554:F506 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly F1 PRO | 3554:F502 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly F1 PRO MAX | 3554:F506 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly F1 PRO MAX Elden | 3554:F506 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly F1 PRO MAX JOJO | 3554:F506 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK DRAGONFLY F1 V2 NK | 373B:114B | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK DRAGONFLY F1 V2 Plus NK | 373B:114A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK DRAGONFLY F1 V2 Pro | 373B:1175 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK DRAGONFLY F1 V2 PRO MAX | 373B:11AB | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK DRAGONFLY F1 V2 SE NK | 373B:114C | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Dragonfly F1S | 3554:F50A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Duckbill ELITE | 373B:1282 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Duckbill EXTREME | 373B:1230 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Duckbill Ultra | 373B:11A6 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 EXTREME | 373B:1045 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 EXTREME 2.0 | 373B:11E3 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 LEVIATAN | 373B:105B | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 LEVIATAN 2.0 | 373B:11F0 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 PRO | 373B:1014 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 PRO MAX | 373B:1015 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 Ultimate | 373B:102E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 Ultimate 2.0 | 373B:11E4 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 Ultimate 2.0 + | 373B:129C | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK F1 Ultra | 373B:103C | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 Ultra Max 2.0 | 373B:11ED | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 Ultra Max 2.0 | 373B:126E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 V3 EXTREME + | 373B:129B | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK F1 V3 LEVIATAN + | 373B:129D | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK F1 V3 ULTIMATE | 373B:12FA | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK F1 V3 ULTIMATE + | 373B:12A7 373B:12A8 373B:12A9 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK F1 V3 ULTIMATE+ | 373B:1304 373B:1308 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK F1 V3 Ultra Max | 373B:1307 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK FIERCE X | 373B:1030 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Flow 7 | 373B:12D7 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Ghost EXTREME | 373B:120D | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Ghost EXTREME + | 373B:128A | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK Ghost Ultimate | 373B:120E 373B:123A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Ghost Ultimate + | 373B:128B | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK MAD R | 373B:103F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK MAD R MAJOR | 373B:103E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK MAD R MAJOR+ | 373B:104C | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK MAD R | 373B:132B | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK MAD R + | 373B:104B | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK PHANTOM ULTIMATE | 373B:1296 373B:12CE 373B:1312 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK U2 | 373B:11AA | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 MINI | 373B:1086 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Mini 2.0 | 373B:11F6 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Mini 2.0 + | 373B:128D | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK U2 NK | 373B:110E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Plus NK | 373B:110D | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Plus NK | 373B:126C 373B:12E3 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Pro | 373B:10EC | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Pro Max | 373B:1158 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Pro Max | 373B:126D | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 SE NK | 373B:1149 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Ultimate | 373B:1087 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Ultimate 2.0 | 373B:11F5 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Ultimate 2.0 + | 373B:128C | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK U2 Ultra | 373B:10AC | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK U2 Ultra Max 2.0 | 373B:11F7 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X EXTREME | 373B:1266 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 | 373B:10D8 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Air + | 373B:127C 373B:12A2 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1 Air+ | 373B:12EC | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1 EXTREME | 373B:10E9 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 EXTREME 2.0 | 373B:11E5 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 EXTREME 2.0 + | 373B:1285 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1 EXTREME GT | 373B:120B | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Lite | 373B:113E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 PRO | 373B:1016 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 PRO MAX | 373B:1017 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 S NK | 373B:1106 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 S NK | 373B:131A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 SE Nearlink | 373B:1299 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK X1 SE NK | 373B:1107 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 SE NK | 373B:130E | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| ATK X1 Ultimate | 373B:103D | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Ultimate 2.0 | 373B:11E7 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Ultimate 2.0 + | 373B:1286 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1 ULTIMATE 2.0+ | 373B:12D9 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1 Ultimate 2.0 Silent | 373B:12B4 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1 Ultra | 373B:102F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Ultra Max 2.0 | 373B:11EC | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Ultra Max 2.0 | 373B:12FF | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Ultra Max 2.0 | 373B:1274 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK X1 Ultra Max 2.0 + Tri-Mode | 373B:12DE | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK X1E | 373B:113F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 NK | 373B:115C | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 Plus NK | 373B:115B | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 Pro | 373B:112E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 PRO MAX | 373B:10FD | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 SE NK | 373B:115D | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 Ultimate | 373B:11CF | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Y9 Ultimate + | 373B:12AF | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK Z1 PRO | 373B:1018 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Z1 PRO MAX | 373B:1019 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Z1 Ultimate 2.0 | 373B:1201 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK Z1 Ultimate 2.0 + | 373B:12B0 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK Z1 Ultra | 373B:104A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK ZERO | 373B:1154 373B:124E | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK ZERO EX | 373B:11CC | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| ATK ZERO EX + | 373B:1289 | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| ATK ZERO + | 373B:129E | `compx` | polling-rate, dpi.current-stage, debounce-ms | dpi.stages |
| VXE R1 | 3554:F58F | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 NK | 373B:1065 373B:1066 373B:10C7 373B:10C8 373B:124C | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 | 373B:1271 | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 PRO | 3554:F58C | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 PRO MAX | 3554:F58C | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 PRO MAX 2.0 NK | 373B:129A | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE R1 PRO MAX | 373B:1273 | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 PRO | 373B:1272 | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 S NK | 373B:121F 373B:124D | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 S NK | 373B:1310 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE R1 SE+ | 373B:12DC 373B:1319 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE R1 UlTRA | 373B:11D2 | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1 Ultra | 373B:11F9 | `compx` | dpi.stages, dpi.current-stage, debounce-ms | polling-rate |
| VXE R1N NK | 373B:1311 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE R1S+ | 373B:1084 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE R1SE | 3554:F58F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE R1SE+ | 3554:F58F | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE R1SE+ Silent | 373B:12BF | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE R2 SE NK | 373B:12B1 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE T1 | 373B:12E1 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE V3 NK | 373B:10E7 373B:1213 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE V3 NK | 373B:12D2 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE V3 Plus | 373B:1215 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE V3 PRO Max | 373B:127B | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE V3 PRO NK | 373B:10E8 373B:1214 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE V3 PRO NK | 373B:1306 | `compx` | – | polling-rate, dpi.stages, dpi.current-stage, debounce-ms |
| VXE X3 | 373B:1248 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE X3 Pro | 373B:1249 | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |
| VXE X3 Turbo | 373B:124A | `compx` | polling-rate, dpi.stages, dpi.current-stage, debounce-ms | – |

## Keyboards

### Mechlands Vibe75

Protocol: `vibe75` ([notes](docs/protocols/vibe75.md))

| Identity | Connection | Detected by UDB |
|---|---|---|
| `0x05AC:0x024F` "Mechlands Vibe75" | wired | Mechlands Vibe75, USB cable; Microsoft Edge 155 on Windows 11 (ROG Zephyrus G14 GA403), 2026-10-15, high confidence |
| `0x05AC:0x024F` "2.4G Dongle" | dongle | not yet |
| `0x05AC:0x024F` "Vibe75-1" | bluetooth | not yet |

| Feature | Location | Status | Read-back | Latest evidence |
|---|---|---|---|---|
| lighting.mode | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| lighting.brightness | device | write-verified | yes | no hardware, 2026-10-15, low confidence |
| lighting.speed | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| lighting.per-key | device | unsupported | – | no hardware, 2026-10-15, low confidence |
| keymap | device | unsupported | – | no hardware, 2026-10-15, low confidence |
| screen-image | device | unsupported | – | no hardware, 2026-10-15, low confidence |

### Not yet seen on hardware by UDB (2)

| Device | USB IDs | Protocol | Experimental | Not supported |
|---|---|---|---|---|
| ASUS ROG Zephyrus G14 (GA403) built-in keyboard | 0B05:19B6 | `asus-aura` | – | lighting.lamparray |
| QMK Keyboard with VIA firmware | any device with FF60:0061 | `qmk-via` | lighting.brightness, lighting.mode, lighting.speed, lighting.color | keymap, macros |

## Headsets

### Not yet seen on hardware by UDB (1)

| Device | USB IDs | Protocol | Experimental | Not supported |
|---|---|---|---|---|
| SteelSeries Arctis Nova 7 | 1038:2202 1038:22A1 1038:227E | `steelseries-arctis` | sidetone, inactive-time-min, battery | eq.software |

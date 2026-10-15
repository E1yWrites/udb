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

### Not yet seen on hardware by UDB (306)

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
| Logitech G PRO 2 LIGHTSPEED | 046D:C09A | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G Pro Wireless | 046D:4079 046D:C088 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G Pro X Wireless Superlight | 046D:4093 046D:C094 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G102 LIGHTSYNC | 046D:C089 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G303 Shroud Edition | 046D:C097 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G402 Gaming Mouse | 046D:C07E | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G403 | 046D:C083 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G403 Hero | 046D:C08F | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G403 Wireless | 046D:405D 046D:C082 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G502 Hero | 046D:C08B | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G502 Hero Wireless | 046D:407F 046D:C08D | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G502 Proteus Core | 046D:C07D | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G502 Proteus Spectrum | 046D:C332 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G502 X | 046D:C099 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech G502 X PLUS | 046D:4099 046D:C095 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G502 X Wireless | 046D:C098 046D:409F | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G602 | 046D:402C | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G603 | 046D:406C 046D:B01C | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G604 | 046D:4085 046D:B024 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G703 | 046D:C087 046D:4070 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G703 Hero | 046D:4086 046D:C090 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G705 | 046D:C096 046D:409D 046D:B02E | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G900 | 046D:C081 046D:4053 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G903 | 046D:C086 046D:4067 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech G903 Hero | 046D:C091 046D:4087 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech Gaming Mouse G Pro | 046D:C085 046D:C08C | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech Gaming Mouse G102/G103/G203 | 046D:C084 046D:C092 046D:C09D | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech Gaming Mouse G302 | 046D:C07F | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech Gaming Mouse G303 | 046D:C080 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech Gaming Mouse G305 | 046D:4074 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech HID++ 2.0 device or receiver | any 046D device with FF00:0001 or FF00:0002 or FF43:0202 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech M325 | 046D:400A | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech M500s | 046D:C093 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech M545 | 046D:4052 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech M585/M590 | 046D:406B 046D:B01B | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech M720 | 046D:405E 046D:B015 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech Marathon M705 | 046D:406D | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Anywhere 2 | 046D:404A 046D:4072 046D:4063 046D:B013 046D:B018 046D:B01F | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Anywhere 2S | 046D:B01A 046D:406A | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Anywhere 3 | 046D:B025 046D:4090 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Anywhere 3B | 046D:B02D | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Anywhere 3S | 046D:B037 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Ergo | 046D:B01D 046D:406F | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Master | 046D:4041 046D:B012 046D:4060 046D:B017 046D:B01E 046D:4071 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Master 2S | 046D:B019 046D:4069 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Master 3 | 046D:B023 046D:4082 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Master 3S | 046D:B034 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Master 3S for Business | 046D:B035 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Master 4 | 046D:B042 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX Vertical | 046D:B020 046D:407B 046D:C08A 046D:C077 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech MX518 | 046D:C08E | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech PRO X SUPERLIGHT 2 | 046D:C09B | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech PRO X SUPERLIGHT 2 DEX | 046D:C0A0 | `logitech-hidpp` | dpi, polling-rate | onboard-profiles, buttons, lighting |
| Logitech T650 | 046D:4101 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Logitech Wireless Touchpad | 046D:4011 | `logitech-hidpp` | dpi, polling-rate, battery | onboard-profiles, buttons, lighting |
| Razer Abyssus 1800 | 1532:0020 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Abyssus 2000 | 1532:005E | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Abyssus 2014 | 1532:0042 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Abyssus Elite (D.Va Edition) | 1532:006A | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Abyssus Essential | 1532:006B | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Abyssus V2 | 1532:005B | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Atheris | 1532:0062 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk | 1532:0064 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk Essential | 1532:0065 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk Mobile | 1532:00D3 1532:00D4 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk Ultimate | 1532:0086 1532:0088 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V2 | 1532:0085 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V3 | 1532:0099 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V3 35K | 1532:00CB | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V3 Pro | 1532:00AA 1532:00AB | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V3 Pro 35K | 1532:00CC 1532:00CD | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V3 Pro 35K Phantom Green | 1532:00D6 1532:00D7 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk V3 X HyperSpeed | 1532:00B9 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Basilisk X HyperSpeed | 1532:0083 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Cobra Pro | 1532:00AF 1532:00B0 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder 1800 | 1532:0038 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder 2000 | 1532:004F | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder 2013 | 1532:0037 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder 3500 | 1532:0054 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder Chroma | 1532:0043 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder Elite | 1532:005C | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder Essential | 1532:006E | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder Essential (2021) | 1532:0098 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder Essential White Edition | 1532:0071 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V2 | 1532:0084 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V2 Lite | 1532:00A1 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V2 Mini | 1532:008C | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V2 Pro | 1532:007C 1532:007D | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V2 X HyperSpeed | 1532:009C | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V3 | 1532:00B2 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V3 HyperSpeed | 1532:00C4 1532:00C5 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V3 Pro | 1532:00B6 1532:00B7 1532:00C2 1532:00C3 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V4 Pro | 1532:00BE 1532:00BF | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer DeathAdder V4 Pro Carbon Fiber Edition | 1532:00EF 1532:00F0 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Diamondback Chroma | 1532:004C | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer HyperPolling Wireless Dongle | 1532:00B3 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Imperator 2012 | 1532:002F | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Lancehead | 1532:0059 1532:005A | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Lancehead Tournament Edition | 1532:0060 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Lancehead Wireless | 1532:006F 1532:0070 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Mamba | 1532:0044 1532:0045 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Mamba 2012 | 1532:0024 1532:0025 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Mamba Elite | 1532:006C | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Mamba Tournament Edition | 1532:0046 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Mamba Wireless | 1532:0072 1532:0073 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Mouse Dock Pro | 1532:00A4 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga | 1532:0015 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga 2012 | 1532:002E | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga 2014 | 1532:0040 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Chroma | 1532:0053 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Epic | 1532:001F | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Epic Chroma | 1532:003E 1532:003F | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Hex | 1532:0041 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Hex (Red) | 1532:0036 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Hex V2 | 1532:0050 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Left-Handed Edition 2020 | 1532:008D | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Pro | 1532:008F 1532:0090 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga Trinity | 1532:0067 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga V2 HyperSpeed | 1532:00B4 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga V2 Pro | 1532:00A7 1532:00A8 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Naga X | 1532:0096 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Orochi | 1532:0048 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Orochi 2013 | 1532:0039 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Orochi V2 | 1532:0094 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Ouroboros 2012 | 1532:0032 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Pro Click | 1532:0077 1532:0080 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Pro Click Mini | 1532:009A | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Pro Click V2 | 1532:00D0 1532:00D1 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Pro Click V2 Vertical Edition | 1532:00C7 1532:00C8 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Taipan | 1532:0034 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper 8KHz | 1532:0091 | `razer` | dpi, polling-rate | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper Mini Signature Edition | 1532:009E 1532:009F | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper Ultimate | 1532:007A 1532:007B | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper V2 Pro | 1532:00A5 1532:00A6 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper V3 HyperSpeed | 1532:00B8 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper V3 Pro | 1532:00C0 1532:00C1 | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
| Razer Viper V3 Pro SE | 1532:00DE 1532:00DF | `razer` | dpi, polling-rate, battery, sleep-timeout, low-power-threshold | dpi.stages, lift-off-distance, buttons, lighting |
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

### Not yet seen on hardware by UDB (21)

| Device | USB IDs | Protocol | Experimental | Not supported |
|---|---|---|---|---|
| ASUS ROG Zephyrus G14 (GA403) built-in keyboard | 0B05:19B6 | `asus-aura` | – | lighting.lamparray |
| Logitech G PRO Keyboard | 046D:C339 | `logitech-hidpp` | polling-rate | onboard-profiles, keymap, lighting |
| Logitech G413 | 046D:C33A | `logitech-hidpp` | polling-rate | onboard-profiles, keymap, lighting |
| Logitech G513 | 046D:C33C | `logitech-hidpp` | polling-rate | onboard-profiles, keymap, lighting |
| Logitech G815 | 046D:C33F | `logitech-hidpp` | polling-rate | onboard-profiles, keymap, lighting |
| Logitech G910 | 046D:C335 | `logitech-hidpp` | polling-rate | onboard-profiles, keymap, lighting |
| Logitech G915 | 046D:C33E | `logitech-hidpp` | polling-rate | onboard-profiles, keymap, lighting |
| Logitech G915 TKL | 046D:C343 046D:B35F | `logitech-hidpp` | polling-rate, battery | onboard-profiles, keymap, lighting |
| QMK Keyboard with VIA firmware | any device with FF60:0061 | `qmk-via` | lighting.brightness, lighting.mode, lighting.speed, lighting.color | keymap, macros |
| Wooting 60HE | 31E3:1300 31E3:1301 31E3:1302 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting 60HE (ARM) | 31E3:1310 31E3:1311 31E3:1312 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting 60HE+ | 31E3:1320 31E3:1321 31E3:1322 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting 60HE V2 | 31E3:1340 31E3:1341 31E3:1342 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting 80HE | 31E3:1400 31E3:1401 31E3:1402 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting One | 03EB:FF01 31E3:1100 31E3:1101 31E3:1102 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting Two | 03EB:FF02 31E3:1200 31E3:1201 31E3:1202 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting Two HE | 31E3:1220 31E3:1221 31E3:1222 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting Two HE (ARM) | 31E3:1230 31E3:1231 31E3:1232 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting Two Lekker Edition | 31E3:1210 31E3:1211 31E3:1212 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting UwU | 31E3:1500 31E3:1501 31E3:1502 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |
| Wooting UwU RGB | 31E3:1510 31E3:1511 31E3:1512 | `wooting` | – | actuation-point, rapid-trigger, lighting, keymap |

## Headsets

### Not yet seen on hardware by UDB (20)

| Device | USB IDs | Protocol | Experimental | Not supported |
|---|---|---|---|---|
| HyperX Cloud Alpha Wireless | 03F0:098D | `hyperx` | – | battery, inactive-time-min, sidetone, voice-prompts |
| HyperX Cloud Flight Wireless | 0951:16C4 0951:1723 | `hyperx` | – | battery |
| HyperX Cloud II Wireless | 03F0:0696 03F0:018B | `hyperx` | – | battery, inactive-time-min |
| HyperX Cloud II Wireless (Kingston) | 0951:1718 | `hyperx` | – | battery, sidetone, inactive-time-min |
| HyperX Cloud III | 03F0:089D 03F0:03CC | `hyperx` | – | sidetone |
| Logitech G PRO headset | 046D:0AA7 | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G PRO X 2 headset | 046D:0AFB 046D:0AFC | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G PRO X headset | 046D:0AAA 046D:0ABA | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G431 headset | 046D:0A9B | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G432 headset | 046D:0A9C | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G433 headset | 046D:0A6D | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G533 headset | 046D:0A66 | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G633 headset | 046D:0A5C | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G635 headset | 046D:0A89 | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G733 headset | 046D:0AB5 046D:0AFE 046D:0B1F | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G933 headset | 046D:0A5B | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech G935 headset | 046D:0A87 | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech Zone 750 headset | 046D:0ADE | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| Logitech Zone Wired headset | 046D:0AAD | `logitech-hidpp` | battery, sidetone | lighting, inactive-time-min, eq.software |
| SteelSeries Arctis Nova 7 | 1038:2202 1038:22A1 1038:227E | `steelseries-arctis` | sidetone, inactive-time-min, battery | eq.software |

# Three-minute FROST demo

1. `npm run dev` in `coldgrid/`, then open the map.
2. Dispatch a tomato from Koyambedu to T. Nagar and press play. Open Copilot. The header says `FROST · rules`. The advice list is the heuristic engine. It is not a model.
3. Turn on Real PPSC readings if the cart is on COM. The newest in-transit truck, or the pinned Kasimedu fish truck, takes the probe temperature. Other trucks stay on the city simulation. The city clock stays on city ambient.
4. The banner shows one move. Under it, the cards show sell-now rupees, the keep-driving arrival price, the price at the city route temperature when that differs from the probe by at least 1°C, and a cold-hub hold at ₹250/h after parking. That city price stays up after the clock copies the probe onto the truck. Confirm hold only if you want the truck to retarget. Confirm sell now only marks the price. The tracking card then shows `Sell ₹…`.
5. Chat: `status of SHP-1`, then `Is the ledger anchored?` (expect "not anchored" while the chain flag is off), then `forecast SHP-1` once four samples exist. `/report` prints the rules note.
6. Insights: click a row. The drawer is the evidence object from the engine, not a sentence from a model.
7. Log: the confirm is listed after the page server accepts it. Memory: save a decision and delete it.

The checked fixture in `lib/copilot/fixture.ts` is a tomato at a 24.6°C probe against a warmer simulated sensor, quality 100%, sell-now ₹20. A live cart replaces 24.6 with the frame on the wire.

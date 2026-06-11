# 🧊 ColdGrid: Chennai Cold-Chain Digital Twin

![ColdGrid Banner](https://img.shields.io/badge/ColdGrid-Digital_Twin-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![deck.gl](https://img.shields.io/badge/deck.gl-GeoJSON-brightgreen?style=for-the-badge)
![Testing](https://img.shields.io/badge/Vitest-Passing-success?style=for-the-badge)

**ColdGrid** is a state-of-the-art Digital Twin and Logistics Academy built for simulating and optimizing perishable cold-chain networks in Chennai, India. 

Powered by a novel **Adaptive Arrhenius + Exponential Moving Average (EMA) spoilage engine**, ColdGrid accurately models the degradation of fresh produce under dynamic environmental conditions, providing actionable insights for routing, energy efficiency, and waste reduction.

---

## ✨ Key Features

### 🏙️ Live Chennai Digital Twin (The Control Room)
- **Real Road Geometries**: Uses `deck.gl` to render a high-fidelity map of Chennai, plotting accurate road networks, flood-prone routes, and major logistics hubs.
- **Live Physics Engine**: A deterministic tick loop processes live shipment locations, tracking temperature, relative humidity, and VOC levels along the transit routes.
- **Dynamic Routing**: Dispatches shipments with options for refrigerated transit (reefers) and dynamically computes Dijkstra-based paths reacting to road closures.

### 🧪 Advanced Spoilage Simulation
- **Patented Kinetics**: Runs an 8-step degradation model leveraging an adaptive Arrhenius equation.
- **Thermal Inertia (EMA)**: Simulates the internal thermal buffering of cargo, distinct from ambient air temperature.
- **Decay Curves**: Implements lazy-loaded `Recharts` to visualize real-time cargo quality decay curves against threshold danger zones.

### 🎓 The Academy (Training & Scenarios)
A complete training loop module featuring 5 real-world crisis scenarios:
1. **Normal Day Tutorial**
2. **40°C Heatwave**
3. **Grid Outage** (Energy Budget Triage)
4. **Monsoon Flooding** (Road Closures & Rerouting)
5. **Festival Surge**
- **Scoring System**: Calculates performance based on food saved, on-time delivery, and carbon/energy efficiency.
- **Pre & Post Assessments**: Evaluates operator learning gains with conceptual quizzes.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Maps & Visualization**: [deck.gl](https://deck.gl/), [MapLibre](https://maplibre.org/), [Recharts](https://recharts.org/)
- **Testing**: [Vitest](https://vitest.dev/) (Comprehensive unit test coverage)

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (>= 18.x) installed on your machine.

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Shubhangam-Singh/Cold-Grid.git
cd coldgrid
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to launch the Twin Control Room.

---

## 🧪 Testing

The simulation engine and routing algorithms are rigorously verified with a comprehensive test suite. 

To run the headless tests locally:
```bash
npm test
```
*Current Coverage: 89/89 tests passing across the simulation, city graph, and academy engine.*

---

## 👨‍💻 Author

**Shubhangam Singh**
- GitHub: [@Shubhangam-Singh](https://github.com/Shubhangam-Singh)

---
*Built with precision for the IEEE Submission core.*

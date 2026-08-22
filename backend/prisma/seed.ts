import { prisma } from "../src/config/prisma";
import { TerrainType } from "../src/generated/prisma/enums";

const SPOTS = [
  { name: "Vermosa", terrainType: TerrainType.ROAD },
  { name: "Davilan", terrainType: TerrainType.ROAD },
  { name: "Bagong Tubig Full Climb", terrainType: TerrainType.ROAD },
  { name: "SUNGAY CLIMB - FULL", terrainType: TerrainType.ROAD },
  { name: "Route 111 Challenge", terrainType: TerrainType.ROAD },
  { name: "King of Revpal #KOR", terrainType: TerrainType.ROAD },
  { name: "2-Kilometer Pain!", terrainType: TerrainType.ROAD },
  { name: "Sampaloc Climb FULL", terrainType: TerrainType.ROAD },
  { name: "Courtyard Climb (part of vermosa loop)", terrainType: TerrainType.ROAD },
  { name: "Santa Rosa Tagaytay Rd Climb Full", terrainType: TerrainType.ROAD },
  { name: "Vermosa Lasalle Uphill (part of vermosal loop)", terrainType: TerrainType.ROAD },
  { name: "Cardiac Hill", terrainType: TerrainType.ROAD },
];

async function main() {
  for (const spot of SPOTS) {
    await prisma.spot.upsert({ where: { name: spot.name }, update: {}, create: spot });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

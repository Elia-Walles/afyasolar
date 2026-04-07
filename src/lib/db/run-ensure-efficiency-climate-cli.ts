import "dotenv/config"
import { ensureEfficiencyClimateTables } from "./ensure-efficiency-climate-tables"

ensureEfficiencyClimateTables()
  .then(() => {
    console.log("Efficiency & climate tables ensured.")
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

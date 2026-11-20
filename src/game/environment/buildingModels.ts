import type { BuildingType } from './envTypes'
import { brickModel, convenienceModel, officeModel, showroomModel } from './modelsCommercial'
import { garageModel, warehouseModel, workshopModel } from './modelsIndustrial'
import { apartmentModel, houseModel } from './modelsResidential'
import type { BuildingModel } from './modelTypes'

/** One procedural model per building type. Each draws into a shared GeometryBuilder. */
export const BUILDING_MODELS: Record<BuildingType, BuildingModel> = {
  office: officeModel,
  'brick-commercial': brickModel,
  apartment: apartmentModel,
  house: houseModel,
  'convenience-store': convenienceModel,
  garage: garageModel,
  showroom: showroomModel,
  warehouse: warehouseModel,
  workshop: workshopModel,
}

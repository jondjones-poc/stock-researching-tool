export const MIN_ACTIVE_ETORO_UNITS = 0.0001;

export interface EtoroPositionLike {
  settlementTypeID?: number;
  settlementTypeId?: number;
  isBuy?: boolean;
  units?: number;
  isDetached?: boolean;
  sharesOwned?: number;
}

/** True when eToro position is an open stock holding (not sold/closed). */
export function isActiveEtoroStockPosition(pos: EtoroPositionLike): boolean {
  const settlementType = pos.settlementTypeID ?? pos.settlementTypeId;
  const units = Number(pos.sharesOwned ?? pos.units) || 0;

  if (settlementType !== 1) return false;
  if (pos.isBuy !== true) return false;
  if (pos.isDetached === true) return false;
  if (units < MIN_ACTIVE_ETORO_UNITS) return false;

  return true;
}

export function isActiveSavedEtoroStock(stock: {
  sharesOwned?: number;
  isDetached?: boolean;
}): boolean {
  const shares = Number(stock.sharesOwned) || 0;
  if (stock.isDetached === true) return false;
  return shares >= MIN_ACTIVE_ETORO_UNITS;
}

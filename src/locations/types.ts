export type GeocodeResult = {
  matchedAddress: string;
  latitude: number;
  longitude: number;
};

export type SavedLocation = {
  id: string;
  userId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  monitorRadiusMiles: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateLocationInput = {
  label: string;
  address: string;
  monitorRadiusMiles: number;
};

export type UpdateLocationInput = {
  label?: string;
  monitorRadiusMiles?: number;
  enabled?: boolean;
};

export interface LocationRepository {
  create(location: SavedLocation): Promise<SavedLocation>;
  findByUser(userId: string): Promise<SavedLocation[]>;
  findByIdAndUser(
    id: string,
    userId: string,
  ): Promise<SavedLocation | undefined>;
  update(
    id: string,
    userId: string,
    data: Partial<
      Pick<
        SavedLocation,
        "label" | "monitorRadiusMiles" | "enabled" | "updatedAt"
      >
    >,
  ): Promise<SavedLocation | undefined>;
  delete(id: string, userId: string): Promise<boolean>;
}

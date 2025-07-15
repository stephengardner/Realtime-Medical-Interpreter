// Common database types and interfaces

export interface BaseDocument {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TimestampedDocument extends BaseDocument {
  createdAt: Date;
  updatedAt: Date;
}

// Add more common types as needed
export type ObjectId = string;

export interface MerchDesign {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  sourceData?: any;
  userSpecs?: ManualSpecs;
  phrase: string;
  niche: string;
  style?: string;
  tone?: string;
  imageUrl: string;
  imagePrompt: string;
  listingTitle: string;
  listingBullets: string[];
  listingDesc: string;
  approved: boolean;
  approvedAt?: Date;
  userRating?: number;
  views: number;
  sales: number;
  parentId?: string;
}

export interface ManualSpecs {
  exactText: string;
  style?: string;
  imageFeature?: string;
  niche?: string;
  tone?: string;
  additionalInstructions?: string;
}

export interface AutopilotParams {
  riskLevel: number;
}

export interface GenerationRequest {
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  specs?: ManualSpecs;
}

export interface GenerationResponse {
  success: boolean;
  design?: MerchDesign;
  error?: string;
}

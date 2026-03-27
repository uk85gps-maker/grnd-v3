export interface LearnMaterial {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  whyUploaded: string;
  whatYouWant: string;
  layerServed: 2 | 3 | 4 | 5 | 6 | 7;
  modesTagged: string[];
  uploadedAt: string;
  isArchived: boolean;
}

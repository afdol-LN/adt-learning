export interface RestAPIResponse<T = any> {
  isError: boolean;
  data: T | null;
  errorMassege: string | null;
}

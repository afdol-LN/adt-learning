export interface restfulResponse<T = any> {
  isError: boolean;
  data: T;
  errorMessage: string;
}

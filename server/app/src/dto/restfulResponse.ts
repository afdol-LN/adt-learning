export interface restfulResponse<T> {
    isError: boolean;
    data: T;
    errorMessage: string;
}
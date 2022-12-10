export interface IMarvelCharacterResultItem {
    id: number;
    name: string;
    description: string;
    thumbnail: {
        path: string;
        extension: string;
    };
    resourceURI: string;
    comics: {
        available: number;
        collectionURI: string;
        items: {
            resourceURI: string;
            name: string;
        }[];
        
    };
}

export interface IMarvelCharacterResult{
    code: number;
    status: string;
    attributionText: string;
    attributionHTML: string;
    etag: string;
    data: {
        offset: number;
        limit: number;
        total: number;
        count: number;
        results: IMarvelCharacterResultItem[];
    };
}

export interface IUser {
    username: string;
    password: string;
}

export interface IRequest<T = IVoid>{
    __returnType?: T;
}

export type RequestResult<T extends IRequest<unknown>> = T extends IRequest<infer R> ? R : never;

export interface IRegisterUser extends IRequest<IVoid> {
    username: string;
    password: string;
}

export interface IVoid {
    result: 'ok';
}

export interface IError {
    isError: boolean;
    message: string;
}

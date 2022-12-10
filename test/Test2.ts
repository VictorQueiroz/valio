export interface ICharacter {
    id: string;
    name: string;
    description: string;
}

export interface ICharacters{
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
        results: {
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
        }[];
    };
}

export interface IUser {
    username: string;
}

export interface IRequest<T = IVoid>{
    __returnType?: T;
}

export type RequestResult<T extends IRequest<unknown>> = T extends IRequest<infer R> ? R : never;

export interface IListCharacters extends IRequest<ICharacters>{
    name?: string;
    nameStartsWith?: string;
    modifiedSince?: string;
    comics?: number;
    series?: number;
    events?: number;
    stories?: number;
    orderBy?: 'name' | '-name' | 'modified' | '-modified';
    limit?: number;
    offset?: number;
}

export interface IRegisterUser extends IRequest<IVoid> {
    username: string;
    password: string;
}

export interface IAuthorization{
    value: string;
    id: string;
}

export interface ISignInUser extends IRequest<IAuthorization> {
    username: string;
    password: string;
}

export interface IVoid {
    status: 'ok';
}

export interface IError {
    status: 'failure';
    message: string;
}

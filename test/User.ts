import { IAttachment } from "./Attachment";

export interface IUser {
    email: string;
    postIds: number[];
}

export interface IPost {
    id: number;
    comments: IComment[];
}

export interface IComment {
    body: string;
    attachments: IAttachment[];
    version: {
        date: Date;
    };
    versions: {
        body: string;
        date: Date;
    }[];
}

export interface IRequestResult<T = IVoid> {
    _returnType?: T;
}

export interface IVoid{

}

export interface IRegisterUser extends IRequestResult {
    username: string;
    password: string;
}

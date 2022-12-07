
export interface IAttachment {
    fileId: number;
    size: number;
    name: string;
    description: string;
    lastModifiedDate: Date;
}

export interface IWithOptionalType {
    name?: string;
}

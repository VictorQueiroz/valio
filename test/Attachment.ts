
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

export interface ITest {
    a?: number;
    b?: string | number;
    c: string | null;
}

import {
    IAttachment,
    IWithOptionalType,
    ITest,
} from '../../test/Attachment';
function isUnknownObject(value: unknown): value is Record<string,unknown> {
    return typeof value === 'object' && value !== null;
}
export function createIAttachment(params: Partial<IAttachment> = {}): IAttachment {
    return Object.freeze(Object.seal({
        "fileId": 0,
        "size": 0,
        "name": '',
        "description": '',
        "lastModifiedDate": new Date(0),
        ...params
    } as IAttachment));
}
export function isIAttachment(value: unknown): value is IAttachment {
    if(!isUnknownObject(value)) return false;
    if(!(typeof value['fileId'] === 'number')) return false;
    if(!(typeof value['size'] === 'number')) return false;
    if(!(typeof value['name'] === 'string')) return false;
    if(!(typeof value['description'] === 'string')) return false;
    if(!(value['lastModifiedDate'] instanceof Date))  return false;
    return true;
}
export function createIWithOptionalType(params: Partial<IWithOptionalType> = {}): IWithOptionalType {
    return Object.freeze(Object.seal({
        "name": '',
        ...params
    } as IWithOptionalType));
}
export function isIWithOptionalType(value: unknown): value is IWithOptionalType {
    if(!isUnknownObject(value)) return false;
    if(!(typeof value['name'] === 'string')) return false;
    return true;
}
export function createITest(params: Partial<ITest> = {}): ITest {
    return Object.freeze(Object.seal({
        "a": 0,
        "b": '',
        "c": '',
        ...params
    } as ITest));
}
export function isITest(value: unknown): value is ITest {
    if(!isUnknownObject(value)) return false;
    if(!(typeof value['a'] === 'number')) return false;
    if(
        !(() => {
            if(!(typeof value['b'] === 'string')) return false;
            return true;
        })() &&
        !(() => {
            if(!(typeof value['b'] === 'number')) return false;
            return true;
        })()
    ) return false;
    if(
        !(() => {
            if(!(typeof value['c'] === 'string')) return false;
            return true;
        })() &&
        !(() => {
            if(!(value['c'] === null)) return false;
            return true;
        })()
    ) return false;
    return true;
}

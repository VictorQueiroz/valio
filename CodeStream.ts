export default class CodeStream {
    readonly #parent;
    #indentationSize;
    #contents;
    #depth;
    public constructor({
        indentationSize = 4,
        parent = null
    }:{
        parent?: CodeStream | null;
        indentationSize?: number;
    } = {}){
        this.#contents = '';
        this.#parent = parent;
        this.#depth = 0;
        this.#indentationSize = indentationSize;
    }
    public write(start: string): void;
    public write(start: string, write: () => void, end: string): void;
    public write(start: string, write?: () => void, end?: string){
        this.append(this.#indent(start));
        if(typeof write === 'undefined' || typeof end === 'undefined'){
            return;
        }
        const result = this.indentBlock(write);
        this.write(end);
        return result;
    }
    public indentBlock(value: () => void){
        this.#increaseDepth();
        value();
        this.#decreaseDepth();
    }
    public append(value: string){
        this.#contents = `${this.#contents}${value}`;
    }
    public value(){
        const contents = this.#contents;
        this.#contents = '';
        return contents;
    }
    #indent(value: string){
        for(let i = 0; i < this.#root().#depth; i++){
            for(let j = 0; j < this.#indentationSize; j++){
                value = ` ${value}`;
            }
        }
        return value;
    }
    #increaseDepth(){
        this.#setDepth(d => d + 1);
    }
    #decreaseDepth(){
        this.#setDepth(d => d - 1);
    }
    #setDepth(getNewDepth: (depth: number) => number){
        const root = this.#root();
        root.#depth = getNewDepth(root.#depth);
    }
    /**
     * @returns root code stream
     */
    #root(){
        let root: CodeStream;
        if(this.#parent){
            root = this.#parent.#root();
        } else {
            root = this;
        }
        return root;
    }
}
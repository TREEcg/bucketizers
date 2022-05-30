import dataset from '@rdfjs/dataset';
import type * as RDF from '@rdfjs/types';
import { Quad } from '@rdfjs/types';
import { getLogger, Logger, RelationParameters, RelationType } from '@treecg/types';
import * as clownface from "clownface";
import { findNodes } from "clownface-shacl-path";
import * as N3 from 'n3';
import { DataFactory } from 'rdf-data-factory';


export type Partial<A, B = {}> = { [P in keyof A]?: A[P] } & { [P in keyof B]: B[P] };

export interface Bucketizer {
    bucketize(quads: Quad[], memberId: string): void;
    importState: (state: any) => void;
    exportState: () => any;
}

export interface BucketizerCoreOptions {
    bucketProperty: string,
    pageSize: number,
}

export abstract class BucketizerCore<Options> implements Bucketizer {
    protected readonly factory: RDF.DataFactory = new DataFactory();
    private bucketHypermediaControlsMap: Map<string, RelationParameters[]>;
    protected options: BucketizerCoreOptions & Options;
    public logger: Logger;

    constructor(options: Partial<BucketizerCoreOptions, Options>) {
        this.bucketHypermediaControlsMap = new Map();
        this.logger = getLogger("bucketizer");

        options.bucketProperty = options.bucketProperty || "http://w3id.org/ldes#bucket";
        if (!options.pageSize) {
            this.logger.warn(`No page size provided. Page size is set to default value = 50`);
            options.pageSize = 50;
        }

        // This is safe, we gave default values to fields of BucketizerCoreOptions
        this.options = <BucketizerCoreOptions & Options>options;
    }

    abstract bucketize(quads: RDF.Quad[], memberId: string): void;

    protected getBucketHypermediaControlsMap(): Map<string, RelationParameters[]> {
        return this.bucketHypermediaControlsMap;
    }

    protected getHypermediaControls(bucket: string, create = false): RelationParameters[] | undefined {
        const out = this.bucketHypermediaControlsMap.get(bucket);
        if (create && out === undefined) {
            const newOut: RelationParameters[] = [];
            this.bucketHypermediaControlsMap.set(bucket, newOut);
            return newOut;
        }
        return out;
    }

    protected addHypermediaControls(bucket: string, ...controls: RelationParameters[]): void {
        if (this.bucketHypermediaControlsMap.get(bucket) != undefined) {
            this.logger.error("overriding hypermediacontrols for bucket " + bucket);
        }
        this.bucketHypermediaControlsMap.set(bucket, controls);
    };

    protected createBucketTriple = (bucket: string, memberId: string): RDF.Quad => this.factory.quad(
        this.factory.namedNode(memberId),
        this.factory.namedNode(this.options.bucketProperty),
        this.factory.literal(bucket, this.factory.namedNode('http://www.w3.org/2001/XMLSchema#string')),
    );

    public exportState(): any | undefined {
        const bucketizerOptions = this.options;
        return {
            bucketizerOptions,
            hypermediaControls: Array.from(this.bucketHypermediaControlsMap.entries()),
        }
    }

    public importState(state: any) {
        this.options = state.bucketizerOptions;
        this.bucketHypermediaControlsMap = new Map(state.hypermediaControls);
    };
}

export interface BucketizerCoreExtOptions {
    root: string;
    propertyPath: string;
}

function extSetDefaults<T>(options: Partial<BucketizerCoreExtOptions, T>): BucketizerCoreExtOptions & T {
    if (options.propertyPath == undefined) {
        throw "expected propertyPath in options but found undefined";
    }
    options.root = options.root || "root";
    return <BucketizerCoreExtOptions & T>options;
}

export abstract class BucketizerCoreExt<Options> extends BucketizerCore<BucketizerCoreExtOptions & Options> {
    public propertyPathQuads: RDF.Quad[];
    private bucketlessPageNumber: number;
    private bucketlessPageMemberCounter: number;

    public constructor(bucketizerOptions: Partial<BucketizerCoreExtOptions, Options>) {
        super(extSetDefaults(bucketizerOptions));
        this.propertyPathQuads = [];
        this.bucketlessPageNumber = 0;
        this.bucketlessPageMemberCounter = 0;
    }

    public setPropertyPathQuads = (propertyPath: string): Promise<void> => new Promise((resolve, reject) => {
        const fullPath = `_:b0 <https://w3id.org/tree#path> ${propertyPath} .`;

        const parser = new N3.Parser();
        parser.parse(fullPath, (error: any, quad: any, prefixes: any) => {
            if (error) {
                reject(error.stack);
            }

            if (quad) {
                this.propertyPathQuads.push(quad);
            } else {
                resolve();
            }
        });
    });

    /**
     * Adds extra triples to the array of quads indicating
     * the buckets in which the version object must be placed
     */
    public bucketize = (quads: RDF.Quad[], memberId: string): void => {
        const propertyPathObjects: RDF.Term[] = this.extractPropertyPathObject(quads, memberId);

        if (propertyPathObjects.length <= 0) {
            this.logger.warn(`No matches found for property path "${this.options.propertyPath}" in member "${memberId}". Applying fallback.`);

            const bucketTriple = this.fallback(memberId);
            quads.push(bucketTriple);

            return;
        }

        let bucketTriples: RDF.Quad[] = [];
        try {
            const buckets = this.createBuckets(propertyPathObjects);
            bucketTriples.push(...buckets.map(bucket => this.createBucketTriple(bucket, memberId)));

        } catch (error: any) {
            this.logger.error(`Error while creating the buckets for member ${memberId}. Applying fallback.`);
            this.logger.info(error);

            bucketTriples.push(this.fallback(memberId));
        }

        quads.push(...bucketTriples);
    };

    /**
     * Selects the bucket for the LDES member based on the value of the property path object
     */
    protected abstract createBuckets: (propertyPathObject: RDF.Term[]) => string[];

    /**
     * Returns the RDF Term that matches the property path and will be used to create a bucket triple
     * @param memberQuads an array of quads representing a member
     * @param memberId identifier of the member
     * @returns an RDF Term
     */
    protected extractPropertyPathObject = (memberQuads: RDF.Quad[], memberId: string): RDF.Term[] => {
        const entryBlankNode = this.getEntryBlanknode().object;
        
        const data = clownface({ dataset: dataset.dataset(memberQuads) }).namedNode(memberId);
        const path = clownface({ dataset: dataset.dataset(this.propertyPathQuads) }).blankNode(<any>entryBlankNode);
        return findNodes(data, path).terms;
    };

    private readonly getEntryBlanknode = (): RDF.Quad =>
        this.propertyPathQuads.find(quad => quad.predicate.value === 'https://w3id.org/tree#path')!;

    public getPropertyPathQuads = (): RDF.Quad[] => this.propertyPathQuads;

    public getBucketProperty(): string {
        return this.options.bucketProperty || "";
    }

    public getRoot(): string {
        return this.options.root || 'root';
    }

    public exportState(): any {
        const state = super.exportState();
        return Object.assign(state, {
            propertyPathQuads: this.propertyPathQuads,
            bucketizerOptions: this.options,
            bucketlessPageNumber: this.bucketlessPageNumber,
            bucketlessPageMemberCounter: this.bucketlessPageMemberCounter
        });
    }

    public importState(state: any): void {
        super.importState(state)
        this.propertyPathQuads = state.propertyPathQuads;
        this.bucketlessPageNumber = state.bucketlessPageNumber;
        this.bucketlessPageMemberCounter = state.bucketlessPageMemberCounter;
    }

    public fallback = (memberId: string): RDF.Quad => {
        const pageSize = this.options.pageSize;

        if (pageSize && this.bucketlessPageMemberCounter === pageSize) {
            this.bucketlessPageNumber++;
            this.bucketlessPageMemberCounter = 0;
        }

        const rootHypermediaControls = this.getHypermediaControls(this.options.root);
        if (!rootHypermediaControls || !rootHypermediaControls.some(parameter => parameter.nodeId === `bucketless-${this.bucketlessPageNumber}`)) {
            const relationParameters: RelationParameters = {
                nodeId: `bucketless-${this.bucketlessPageNumber}`,
                type: RelationType.Relation
            }

            this.addHypermediaControls(`${this.options.root}`, relationParameters);
        }

        this.bucketlessPageMemberCounter++;
        return this.createBucketTriple(`bucketless-${this.bucketlessPageNumber}`, memberId);
    }
}

import type * as RDF from '@rdfjs/types';
import type { Quad } from '@rdfjs/types';
import { Bucketizer, Logger, RelationParameters, BucketizerCoreOptions, BucketizerCoreExtOptions, Member, LDES } from '@treecg/types';
import { getLogger, RelationType, TREE, RDF as RDFT, SDS } from '@treecg/types';
import * as N3 from 'n3';
import { DataFactory } from 'rdf-data-factory';

export type Partial<A, B = {}> = { [P in keyof A]?: A[P] } & { [P in keyof B]: B[P] };
export type BucketId = string;

export function findProperty(quads: RDF.Quad[], subject: RDF.Term, predicate: RDF.Term): RDF.Term {
  const quad = quads.find(q => q.subject.value === subject.value && q.predicate.value === predicate.value);
  if (!quad) {
    throw "Not found!";
  }
  return quad.object;
}

export function parseBucketizerCoreOptions(quads: RDF.Quad[], subject: RDF.Term): BucketizerCoreOptions & { 'type': RDF.Term } {
  const out = <BucketizerCoreOptions & { 'type': RDF.Term }>{};

  try {
    out.bucketProperty = findProperty(quads, subject, LDES.terms.bucketProperty).value;
  } catch (e: any) { }

  try {
    const pageSize = findProperty(quads, subject, LDES.terms.custom("pageSize")).value;
    out.pageSize = parseInt(pageSize);
  } catch (e: any) {
    out.pageSize = 50;
  }

  out.type = findProperty(quads, subject, LDES.terms.bucketType);

  return out;
}

function loop_list(quads: RDF.Quad[], subject: RDF.Term): RDF.Term[] | undefined {
  let current = subject;
  const out: RDF.Term[] = [];

  while (!current.equals(RDFT.terms.nil)) {
    const next = quads.find(q => q.subject.equals(current) && q.predicate.equals(RDFT.terms.rest));
    if (!next) return;

    const value =
      quads.find(q => q.subject.equals(current) && q.predicate.equals(RDFT.terms.first))?.object;
    if (!value) return;

    out.push(value);
    current = next.object;
  }

  return out;

}

export function parseBucketizerExtCoreOptions(quads: RDF.Quad[], subject: RDF.Term): BucketizerCoreExtOptions & { 'type': RDF.Term } {
  const options = <BucketizerCoreExtOptions & { 'type': RDF.Term }>parseBucketizerCoreOptions(quads, subject);

  try {
    options.root = findProperty(quads, subject, LDES.terms.custom("isBucketRoot")).value
  } catch (e: any) {
    options.root = 'root';
  }

  const path = quads.find(q => q.subject.value === subject.value && q.predicate.equals(TREE.terms.path))?.object;
  if (!path) {
    throw "Predicate tree:path not found!";
  }
  const list = loop_list(quads, path);
  const property = <RDF.Quad[]>(list ? list : [path]);
  options.propertyPath = property;

  return options;
}



export abstract class BucketizerCore<Options> implements Bucketizer {
  protected readonly factory: RDF.DataFactory = new DataFactory();
  private bucketHypermediaControlsMap: Map<BucketId, RelationParameters[]>;
  public options: BucketizerCoreOptions & Options;
  public logger: Logger;

  constructor(options: Partial<BucketizerCoreOptions, Options>) {
    this.bucketHypermediaControlsMap = new Map();
    this.logger = getLogger('bucketizer');

    if (!options.pageSize) {
      this.logger.warn(`No page size provided. Page size is set to default value = 50`);
      options.pageSize = 50;
    }

    // This is safe, we gave default values to fields of BucketizerCoreOptions
    this.options = <BucketizerCoreOptions & Options>options;
  }

  private bucketNode(id: string): RDF.NamedNode {
    return this.factory.namedNode(id);
  }

  public getRoot(): string {
    return "";
  }

  abstract bucketize(quads: RDF.Quad[], memberId: string): RDF.Quad[];

  public getBucketHypermediaControlsMap(): Map<string, RelationParameters[]> {
    return this.bucketHypermediaControlsMap;
  }

  public getHypermediaControls(bucket: BucketId, create: true): RelationParameters[];
  public getHypermediaControls(bucket: BucketId, create?: boolean): RelationParameters[] | undefined;

  public getHypermediaControls(bucket: BucketId, create = false): RelationParameters[] | undefined {
    const out = this.bucketHypermediaControlsMap.get(bucket);
    if (create && out === undefined) {
      const newOut: RelationParameters[] = [];
      this.bucketHypermediaControlsMap.set(bucket, newOut);
      return newOut;
    }
    return out;
  }

  protected expandRelation(from: string, to: RelationParameters): RDF.Quad[] {
    //
    //  <bucket1> sds:relation [
    //    sds:relationType tree:GreaterThanRelation ;
    //    sds:relationBucket <bucket2> ;
    //    sds:relationPath <thing> ;
    //    sds:relationValue 1;
    //    sds:relationPath ex:x
    //  ] .
    //

    const sourceId = this.bucketNode(from);
    const targetId = this.bucketNode(to.nodeId);
    const relationId = this.factory.blankNode();

    const out: RDF.Quad[] = [];
    out.push(this.factory.quad(sourceId, SDS.terms.custom('relation'), relationId));
    out.push(this.factory.quad(relationId, SDS.terms.custom('relationType'), this.factory.namedNode(to.type)));
    out.push(this.factory.quad(relationId, SDS.terms.custom('relationBucket'), targetId));
    for (const value of to.value || []) {
      out.push(this.factory.quad(relationId, SDS.terms.custom('relationValue'), <RDF.Quad_Object>value));
    }
    if (to.path) {
      out.push(this.factory.quad(relationId, SDS.terms.custom('relationPath'), <RDF.Quad_Object>to.path));
    }

    // Add information about root buckets
    if (from === this.getRoot()) {
      out.push(this.factory.quad(sourceId, SDS.terms.custom('isRoot'), this.factory.literal("true")));
    }
    if (to.nodeId === this.getRoot()) {
      out.push(this.factory.quad(targetId, SDS.terms.custom('isRoot'), this.factory.literal("true")));
    }

    return out;
  }

  protected createSDSRecord(id: RDF.Term, buckets: string[]): RDF.Quad[] {
    const out: RDF.Quad[] = [];
    const sdsId = this.factory.blankNode();

    out.push(this.factory.quad(sdsId, SDS.terms.custom('payload'), <RDF.Quad_Object>id));
    for (const bucket of buckets) {
      out.push(this.factory.quad(sdsId, SDS.terms.custom('bucket'), this.bucketNode(bucket)));
    }

    return out;
  }

  protected setHypermediaControls(bucket: BucketId, ...controls: RelationParameters[]): void {
    if (this.bucketHypermediaControlsMap.get(bucket) != undefined) {
      this.logger.warn(`overriding hypermediacontrols for bucket ${bucket}`);
    }
    this.bucketHypermediaControlsMap.set(bucket, controls);
  }

  protected addHypermediaControls(bucket: BucketId, ...newControls: RelationParameters[]): void {
    const controls = this.getHypermediaControls(bucket, true);
    controls.push(...newControls);
  }

  public exportState(): any | undefined {
    const bucketizerOptions = this.options;
    return {
      bucketizerOptions,
      hypermediaControls: Array.from(this.bucketHypermediaControlsMap.entries()),
    };
  }

  public importState(state: any) {
    this.options = state.bucketizerOptions;
    this.bucketHypermediaControlsMap = new Map(state.hypermediaControls);
  }
}

function extSetDefaults<T>(options: Partial<BucketizerCoreExtOptions, T>): BucketizerCoreExtOptions & T {
  if (options.propertyPath == undefined) {
    throw 'expected propertyPath in options but found undefined';
  }
  options.root = options.root || 'root';
  return <BucketizerCoreExtOptions & T>options;
}

export abstract class BucketizerCoreExt<Options = {}> extends BucketizerCore<BucketizerCoreExtOptions & Options> {
  public propertyPathPredicates: RDF.Term[];
  private bucketlessPageNumber: number;
  private bucketlessPageMemberCounter: number;

  public constructor(bucketizerOptions: Partial<BucketizerCoreExtOptions, Options>) {
    super(extSetDefaults(bucketizerOptions));
    this.propertyPathPredicates = [];
    this.bucketlessPageNumber = 0;
    this.bucketlessPageMemberCounter = 0;

    this.setPropertyPathQuads(this.options.propertyPath);
  }

  public getPropertyPathMember(): Member {
    if (this.propertyPathPredicates.length === 1) {
      console.log('propetyPath predicate with only one step');
      return {
        id: this.propertyPathPredicates[0],
        quads: [],
      };
    }

    const quads: RDF.Quad[] = [];
    let id: RDF.Term = RDFT.terms.nil;

    for (const pred of this.propertyPathPredicates) {
      const newId = this.factory.blankNode();

      quads.push(
        this.factory.quad(
          newId, RDFT.terms.rest, id,
        ),
        this.factory.quad(
          newId, RDFT.terms.first, <any>pred,
        ),
      );

      id = newId;
    }

    return {
      quads, id,
    };
  }

  private setPropertyPathQuads(propertyPath: string | Quad[]): void {
    let quads;
    if (Array.isArray(propertyPath)) {
      this.propertyPathPredicates = <RDF.Term[]>propertyPath;
      return;
    } else {
      const fullPath = `_:b0 <https://w3id.org/tree#path> ${propertyPath} .`;
      quads = new N3.Parser().parse(fullPath);
    }

    let source = quads.find(quad => quad.predicate.value === TREE.path)!.object;

    const hasNext = quads.find(quad => quad.subject.equals(source));

    if (hasNext) {
      while (!source.equals(RDFT.terms.nil)) {
        const listNodes = quads.filter(quad => quad.subject.equals(source));

        source = listNodes.find(quad => quad.predicate.equals(RDFT.terms.rest))!.object;
        const item = listNodes.find(quad => quad.predicate.equals(RDFT.terms.first))!.object;

        this.propertyPathPredicates.push(item);
      }
    } else {
      this.propertyPathPredicates.push(source);
    }
  }

  /**
     * Returns triples indicating the buckets in which the version object must be place
     * and information about these bucket and how they relate
     *
     * Note: This information about buckets is stateful, a previous bucket may be referred to.
     */
  public bucketize(quads: RDF.Quad[], memberId: string): RDF.Quad[] {
    const propertyPathObjects: RDF.Term[] = this.extractPropertyPathObject(quads, memberId);
    const newRelations: [string, RelationParameters][] = [];
    const bucketNodes: string[] = [];


    if (propertyPathObjects.length <= 0) {
      this.logger.warn(`No matches found for property path "${this.options.propertyPath}" in member "${memberId}". Applying fallback.`);

      const bucketNode = this.fallback(newRelations);
      bucketNodes.push(bucketNode);
    } else {
      try {
        const buckets = this.createBuckets(propertyPathObjects, newRelations);
        bucketNodes.push(...buckets);
      } catch (error: any) {
        this.logger.error(`Error while creating the buckets for member ${memberId}. Applying fallback.`);
        this.logger.info(error);

        bucketNodes.push(this.fallback(newRelations));
      }
    }

    const out = [
      ...newRelations.flatMap(([source, rel]) => this.expandRelation(source, rel)),
      ...this.createSDSRecord(this.factory.namedNode(memberId), bucketNodes),
    ];

    const propMember = this.getPropertyPathMember();
    if (newRelations.some(([_, rel]) => rel?.path && rel.path.equals(propMember.id))) {
      out.push(...propMember.quads);
    }

    return out;
  }

  /**
     * Selects the bucket for the LDES member based on the value of the property path object
     */
  protected abstract createBuckets(propertyPathObject: RDF.Term[], newRelations: [string, RelationParameters][]): string[];

  /**
     * Returns the RDF Term that matches the property path and will be used to create a bucket triple
     * @param memberQuads an array of quads representing a member
     * @param memberId identifier of the member
     * @returns an RDF Term
     */
  protected extractPropertyPathObject = (memberQuads: RDF.Quad[], memberId: string | RDF.Term, properties = this.propertyPathPredicates): RDF.Term[] => {
    const memberTerm = typeof memberId === 'string' ? this.factory.namedNode(memberId) : memberId;

    if (properties.length === 0) {
      return [memberTerm];
    }

    const head = properties[0];
    return memberQuads
      .filter(quad => quad.subject.equals(memberTerm))
      .filter(quad => quad.predicate.equals(head))
      .flatMap(member => this.extractPropertyPathObject(memberQuads, member.object, properties.slice(1)));
  };

  public getPropertyPathPredicates(): RDF.Term[] {
    return this.propertyPathPredicates;
  }

  public exportState(): any {
    const state = super.exportState();
    return Object.assign(state, {
      propertyPathPredicates: this.propertyPathPredicates,
      bucketizerOptions: this.options,
      bucketlessPageNumber: this.bucketlessPageNumber,
      bucketlessPageMemberCounter: this.bucketlessPageMemberCounter,
    });
  }

  public getRoot(): string {
    return this.options.root || "root";
  }

  public importState(state: any): void {
    super.importState(state);
    this.propertyPathPredicates = state.propertyPathPredicates;
    this.bucketlessPageNumber = state.bucketlessPageNumber;
    this.bucketlessPageMemberCounter = state.bucketlessPageMemberCounter;
  }

  public fallback = (newRelations: [string, RelationParameters][]): string => {
    const pageSize = this.options.pageSize;

    if (pageSize && this.bucketlessPageMemberCounter === pageSize) {
      this.bucketlessPageNumber++;
      this.bucketlessPageMemberCounter = 0;
    }

    const rootHypermediaControls = this.getHypermediaControls(this.options.root);
    if (!rootHypermediaControls || !rootHypermediaControls.some(parameter => parameter.nodeId === `bucketless-${this.bucketlessPageNumber}`)) {
      const relationParameters: RelationParameters = {
        nodeId: `bucketless-${this.bucketlessPageNumber}`,
        type: RelationType.Relation,
      };

      newRelations.push([`${this.getRoot()}`, relationParameters]);
      this.setHypermediaControls(`${this.getRoot()}`, relationParameters);
    }

    this.bucketlessPageMemberCounter++;
    return `bucketless-${this.bucketlessPageNumber}`;
  };
}

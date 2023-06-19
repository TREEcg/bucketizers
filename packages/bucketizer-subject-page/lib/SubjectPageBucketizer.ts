import type * as RDF from '@rdfjs/types';
import { Term } from '@rdfjs/types';
import { BucketizerCoreExt, Factory, parseBucketizerExtCoreOptions } from '@treecg/bucketizer-core';
import { RelationParameters, BucketizerCoreExtOptions, LDES, Bucketizer } from '@treecg/types';
import { RelationType } from '@treecg/types';

export class SubjectPageBucketizerFactory implements Factory<SubjectInputType> {
  type: string = "subject";
  build(config: BucketizerCoreExtOptions, state?: any): Bucketizer {
    return SubjectPageBucketizer.build(config, state);
  }

  ldConfig(quads: RDF.Quad[], subject: RDF.Term): SubjectInputType | void {
    const out = <SubjectInputType & { type: Term }>parseBucketizerExtCoreOptions(quads, subject);
    const maxRelations = quads.find(q => q.subject.equals(subject) && q.predicate.equals(LDES.terms.custom("maxRelations")))?.object.value;
    if (maxRelations) {
      out.maxRelations = parseInt(maxRelations);
    }
    if (out.type.value === LDES.custom("subject")) {
      return out;
    } else {
      return;
    }
  }
}

export type SubjectInputType = BucketizerCoreExtOptions & { maxRelations?: number };
export class SubjectPageBucketizer extends BucketizerCoreExt<{ maxRelations?: number }> {
  rootRelationCount = 0;
  rootCount = 0;
  maxRelations = 50;
  hash = "" 

  public static build(bucketizerOptions: Partial<SubjectInputType>, state?: any): SubjectPageBucketizer {
    const bucketizer = new SubjectPageBucketizer(bucketizerOptions);
    bucketizer.maxRelations = bucketizerOptions.maxRelations || 100;
    bucketizer.hash = Math.random().toString(36).substr(2, 5)


    if (state) {
      bucketizer.importState(state);
    }

    return bucketizer;
  }

  private getRootName(): string {
    if (this.rootCount === 0) {
      return this.getRoot();
    } else {
      return this.getRoot() + '-' + this.rootCount;
    }
  }

  private getCurrentStart(newRelations: [string, RelationParameters][], immutables: string[]): string {
    if (this.rootRelationCount === this.maxRelations) {
      const from = this.getRootName();
      immutables.push(from);
      this.rootRelationCount = 0;
      this.rootCount += 1;
      const to = this.getRootName();
      newRelations.push(
        [from, {
          type: RelationType.Relation,
          nodeId: to,
        }]
      );
    }
    this.rootRelationCount += 1;

    return this.getRootName();
  }

  protected createBuckets(propertyPathObjects: RDF.Term[], newRelations: [string, RelationParameters][], immutables: string[]): string[] {
    const buckets: string[] = [];

    propertyPathObjects.forEach(propertyPathObject => {
      const parts = propertyPathObject.value.split('/');
      const part = parts[parts.length - 1] + '-' + this.hash;
      if (!part) return;

      const hypermediaControlsMap = this.getBucketHypermediaControlsMap();
      const id = this.normalize(part);

      if (!hypermediaControlsMap.has(id)) {
        hypermediaControlsMap.set(id, []);

        const propMember = this.getPropertyPathMember();
        newRelations.push([this.getCurrentStart(newRelations, immutables), this.createRelationParameters(id, propertyPathObject, propMember.id)]);
      }

      buckets.push(id);
    });

    return buckets;
  };

  private readonly normalize = (literal: string): string =>
    literal.trim().normalize('NFKD')
      .replace(/[\u0300-\u036F]/gu, '')
      .replace(/[,']/gu, '')
      .replace(/#/gu, '-')
      .toLowerCase();

  private createRelationParameters(id: string, value: Term, pathObject: RDF.Term): RelationParameters {
    return {
      type: RelationType.EqualThan,
      value: [value],
      nodeId: id,
      path: pathObject,
    };
  }

  public exportState(): any {
    const state = super.exportState();
    state.rootRelationCount = this.rootRelationCount;
    state.rootCount = this.rootCount;
    state.maxRelations = this.maxRelations;
    state.hash = this.hash;
    return state;
  }

  public importState(state: any): void {
    super.importState(state);
    this.rootRelationCount = state.rootRelationCount;
    this.rootCount = state.rootCount;
    this.maxRelations = state.maxRelations;
    this.hash = state.hash;
  }
}


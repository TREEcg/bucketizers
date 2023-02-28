import type * as RDF from '@rdfjs/types';
import { Factory, parseBucketizerExtCoreOptions, Partial } from '@treecg/bucketizer-core';
import { BucketizerCoreExt } from '@treecg/bucketizer-core';
import { Bucketizer, LDES, RelationType } from '@treecg/types';
import type { RelationParameters, BucketizerCoreExtOptions } from '@treecg/types';

export class SubstringBucketizerFactory implements Factory<BucketizerCoreExtOptions> {
    type: string = "substring";
    build(config: BucketizerCoreExtOptions, state?: any): Bucketizer {
      return SubstringBucketizer.build(config, state);
    }

  ldConfig(quads: RDF.Quad[], subject: RDF.Term): BucketizerCoreExtOptions {
    const out = parseBucketizerExtCoreOptions(quads, subject);
    if(out.type.value === LDES.custom(this.type)) {
      return out;
    } else {
      throw "Exptected type " + LDES.custom("substring");
    }
  }
}

export type SubstringInputType = Partial<BucketizerCoreExtOptions>;
export class SubstringBucketizer extends BucketizerCoreExt<{}> {
  public bucketCounterMap: Map<string, number>;

  private constructor(bucketizerOptions: SubstringInputType) {
    super(bucketizerOptions);

    this.bucketCounterMap = new Map<string, number>();
    this.bucketCounterMap.set(this.getRoot(), 0);
  }

  public static build(bucketizerOptions: SubstringInputType, state?: any): SubstringBucketizer {
    const bucketizer = new SubstringBucketizer(bucketizerOptions);

    if (state) {
      bucketizer.importState(state);
    }

    return bucketizer;
  }

  protected createBuckets = (propertyPathObjects: RDF.Term[], newRelations: [string, RelationParameters][]): string[] => {
    const buckets: string[] = [];
    propertyPathObjects.forEach(propertyPathObject => {
      const normalizedLiteral = this.normalize(propertyPathObject.value);

      const parts = normalizedLiteral.split(' ');
      let currentBucket = this.getRoot();
      let substring = '';
      let bucketFound = false;

      for (const part of parts) {
        for (const character of part) {
          if (this.hasRoom(currentBucket)) {
            this.updateCounter(currentBucket);
            buckets.push(currentBucket);
            bucketFound = true;

            break;
          } else {
            substring += character;
            const hypermediaControls = this.getHypermediaControls(currentBucket, true);

            if (hypermediaControls.every(relationParametersObject => relationParametersObject.nodeId !== substring)) {
              const relationParameters = this.createRelationParameters(substring, substring.split('+'));
              newRelations.push([currentBucket, relationParameters]);
              this.addHypermediaControls(currentBucket, relationParameters);

              currentBucket = substring;

              this.updateCounter(currentBucket);
              buckets.push(currentBucket);
              bucketFound = true;

              break;
            } else {
              currentBucket = substring;
            }
          }
        }

        if (bucketFound) {
          break;
        }

        if (parts.length > 1) {
          substring += '+';
        } else {
          buckets.push(substring);
          break;
        }
      }
    });

    return [...new Set(buckets)];
  };

  public exportState(): any {
    const state = super.exportState();
    state.bucketCounter = Array.from(this.bucketCounterMap.entries());

    return state;
  }

  public importState(state: any): void {
    super.importState(state);
    this.bucketCounterMap = new Map(state.bucketCounter);
  }

  /**
     * Normalizes a string by removing diacritics and comma's,
     * replaces hyphens with spaces
     * and finally transforms the string to lowercase
     * @param literal object value from an RDF.Quad
     * @returns the normalized object value
     */
  private readonly normalize = (literal: string): string =>
    literal.trim().normalize('NFKD')
      // .replace(/\p{Diacritic}/gu, '')
      .replace(/[\u0300-\u036F]/gu, '')
      .replace(/[,']/gu, '')
      .replace(/[-]/gu, ' ')
      .toLowerCase();

  private readonly hasRoom = (bucket: string): boolean =>
    !this.bucketCounterMap.has(bucket) || this.bucketCounterMap.get(bucket)! < this.options.pageSize;

  private readonly updateCounter = (bucket: string): void => {
    // A member who has multiple objects for the property path (e.g. language tags)
    // will be placed in different buckets.
    // However, it is possible that for each language, the same bucket is selected
    // Then the counter must only be updated once, because the member is only added once
    const count = this.bucketCounterMap.get(bucket) || 0;
    this.bucketCounterMap.set(bucket, count + 1);
  };

  private readonly createRelationParameters = (
    targetNode: string,
    values: string[],
  ): RelationParameters => ({
    nodeId: targetNode,
    type: RelationType.Substring,
    value: values.map(value =>
      this.factory.literal(value, this.factory.namedNode('http://www.w3.org/2001/XMLSchema#string'))),
  });
}

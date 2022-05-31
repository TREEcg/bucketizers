import type * as RDF from '@rdfjs/types';
import type { RelationParameters } from '@treecg/types';
import { RelationType } from '@treecg/types';
import { BucketizerCoreExt, BucketizerCoreExtOptions, Partial } from '@treecg/bucketizer-core';

export type SubstringInputType = Partial<BucketizerCoreExtOptions>;
export class SubstringBucketizer extends BucketizerCoreExt<{}> {
  public bucketCounterMap: Map<string, number>;

  private constructor(bucketizerOptions: SubstringInputType) {
    super(bucketizerOptions);

    this.bucketCounterMap = new Map<string, number>();
    this.bucketCounterMap.set(this.options.root, 0);
  }

  public static build(bucketizerOptions: SubstringInputType, state?: any): SubstringBucketizer {
    const bucketizer = new SubstringBucketizer(bucketizerOptions);

    if (state) {
      bucketizer.importState(state);
    }

    return bucketizer;
  }

  protected createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];
    propertyPathObjects.forEach(propertyPathObject => {
      const normalizedLiteral = this.normalize(propertyPathObject.value);

      const parts = normalizedLiteral.split(' ');
      let currentBucket = this.options.root;
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
            const hypermediaControls = this.getHypermediaControls(currentBucket);

            if (hypermediaControls === undefined ||
              // eslint-disable-next-line @typescript-eslint/no-loop-func
              !hypermediaControls.some(relationParametersObject => relationParametersObject.nodeId === substring)) {
              const relationParameters = this.createRelationParameters(substring, substring.split('+'));
              if (hypermediaControls === undefined) {
                this.addHypermediaControls(currentBucket, relationParameters);
              } else {
                this.addHypermediaControls(currentBucket, ...hypermediaControls, relationParameters);
              }

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

        // It's possible that a bucket was not found yet for a substring, but that there are
        // no other parts anymore to iterate, so we still have to add that substring to the bucket
        // It's possible that we exceed the page limit.
        // If there are other parts, add '+' to the substring
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

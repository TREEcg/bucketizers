import type * as RDF from '@rdfjs/types';
import { Bucketizer } from '@treecg/types';

const ROOT = 'root';

export class SubstringBucketizer extends Bucketizer {
  public propertyPath: string;
  public pageSize: number;
  public bucketCounterMap: Map<string, number>;

  public constructor(propertyPath: string, pageSize: number) {
    super(propertyPath);
    this.propertyPath = propertyPath;
    this.pageSize = pageSize;

    this.bucketCounterMap = new Map<string, number>();
    this.bucketCounterMap.set(ROOT, 0);
  }

  public static build = async (propertyPath: string, pageSize: number): Promise<SubstringBucketizer> => {
    const bucketizer = new SubstringBucketizer(propertyPath, pageSize);
    await bucketizer.init();
    return bucketizer;
  };

  public bucketize = (quads: RDF.Quad[], memberId: string): void => {
    const propertyPathObjects: RDF.Term[] = this.extractPropertyPathObject(quads, memberId);

    if (propertyPathObjects.length <= 0) {
      throw new Error(`[SubstringBucketizer]: No matches found for property path "${this.propertyPath}"`);
    }

    const buckets = this.createBuckets(propertyPathObjects);
    const bucketTriples = buckets.map(bucket => this.createBucketTriple(bucket, memberId));
    quads.push(...bucketTriples);
  };

  public createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];
    propertyPathObjects.forEach(propertyPathObject => {
      const normalizedLiteral = this.normalize(propertyPathObject.value);

      const parts = normalizedLiteral.split(' ');
      let currentBucket = ROOT;
      let substring = '';
      let bucketFound = false;

      for (const part of parts) {
        for (const character of [...part]) {
          if (this.hasRoom(currentBucket)) {
            this.updateCounter(currentBucket, buckets);
            buckets.push(currentBucket);
            bucketFound = true;

            break;
          } else {
            substring += character;
            const hypermediaControls = this.getHypermediaControls(currentBucket);

            if (hypermediaControls === undefined || !hypermediaControls.includes(substring)) {
              const updatedControls = hypermediaControls === undefined ?
                [substring] :
                [...hypermediaControls, substring];

              this.addHypermediaControls(currentBucket, updatedControls);
              currentBucket = substring;

              this.updateCounter(currentBucket, buckets);
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
        // It's possible to we exceed the page limit.
        // If there are other parts, add '+' to the substring
        if (propertyPathObjects.length > 1) {
          substring += '+';
        } else {
          buckets.push(substring);
          break;
        }
      }
    });

    return [...new Set(buckets)];
  };

  /**
   * Normalizes a string by removing diacritics and comma's,
   * replaces hyphens with spaces
   * and finally transforms the string to lowercase
   * @param literal object value from an RDF.Quad
   * @returns the normalized object value
   */
  private readonly normalize = (literal: string): string =>
    literal.trim().normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[,']/gu, '')
      .replace(/[-]/gu, ' ')
      .toLowerCase();

  private readonly hasRoom = (bucket: string): boolean =>
    !this.bucketCounterMap.has(bucket) || this.bucketCounterMap.get(bucket)! < this.pageSize;

  private readonly updateCounter = (bucket: string, buckets: string[]): void => {
    // A member who has multiple objects for the property path (e.g. language tags)
    // will be placed in different buckets.
    // However, it is possible that for each language, the same bucket is selected
    // Then the counter must only be updated once, because the member is only added once
    if (!buckets.includes(bucket)) {
      const count = this.bucketCounterMap.get(bucket) || 0;
      this.bucketCounterMap.set(bucket, count + 1);
    }
  };
}
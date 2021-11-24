import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions } from '@treecg/types';
import { Bucketizer } from '@treecg/types';

export class SubjectPageBucketizer extends Bucketizer {
  private constructor(bucketizerOptions: BucketizerOptions) {
    super(bucketizerOptions);
  }

  public static async build(bucketizerOptions: BucketizerOptions, state?: any): Promise<SubjectPageBucketizer> {
    if (!bucketizerOptions.propertyPath) {
      throw new Error(`[SubjectPageBucketizer]: Please provide a valid property path.`);
    }

    // TODO: page size is needed for pages containing the hypermedia controls

    const bucketizer = new SubjectPageBucketizer(bucketizerOptions);

    if (state) {
      bucketizer.importState(state);
    } else {
      await bucketizer.setPropertyPathQuads(bucketizerOptions.propertyPath);
    }

    return bucketizer;
  }

  protected createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];

    propertyPathObjects.forEach(propertyPathObject => {
      const parts = propertyPathObject.value.split('/');
      if (parts[parts.length - 1] !== undefined) {
        const hypermediaControlsMap = this.getBucketHypermediaControlsMap();
        const id = parts[parts.length - 1];

        if (!hypermediaControlsMap.has(id)) {
          hypermediaControlsMap.set(id, []);
        }

        buckets.push(id);
      }
    });

    return buckets;
  };
}

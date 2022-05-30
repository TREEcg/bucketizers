import type * as RDF from '@rdfjs/types';
import { BucketizerCoreExt, BucketizerCoreExtOptions } from '../../bucketizer-basic/node_modules/@treecg/bucketizer-core';

export type SubjectInputType = Partial<BucketizerCoreExtOptions>;
export class SubjectPageBucketizer extends BucketizerCoreExt<{}> {
  private constructor(bucketizerOptions: SubjectInputType) {
    super(bucketizerOptions);
  }

  public static async build(bucketizerOptions: SubjectInputType, state?: any): Promise<SubjectPageBucketizer> {
    const bucketizer = new SubjectPageBucketizer(bucketizerOptions);

    if (state) {
      bucketizer.importState(state);
    } else {
      await bucketizer.setPropertyPathQuads(bucketizerOptions.propertyPath!);
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

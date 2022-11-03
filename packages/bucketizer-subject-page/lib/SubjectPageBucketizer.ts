import type * as RDF from '@rdfjs/types';
import { BucketizerCoreExt } from '@treecg/bucketizer-core';
import type { RelationParameters, BucketizerCoreExtOptions } from '@treecg/types';
import { RelationType } from '@treecg/types';

export type SubjectInputType = Partial<BucketizerCoreExtOptions>;
export class SubjectPageBucketizer extends BucketizerCoreExt<{}> {
  public static build(bucketizerOptions: SubjectInputType, state?: any): SubjectPageBucketizer {
    const bucketizer = new SubjectPageBucketizer(bucketizerOptions);

    if (state) {
      bucketizer.importState(state);
    }

    return bucketizer;
  }

  protected createBuckets(propertyPathObjects: RDF.Term[], newRelations: [string, RelationParameters][]): string[] {
    const buckets: string[] = [];

    propertyPathObjects.forEach(propertyPathObject => {
      const parts = propertyPathObject.value.split('/');
      if (parts[parts.length - 1] !== undefined) {
        const hypermediaControlsMap = this.getBucketHypermediaControlsMap();
        const id = parts[parts.length - 1];

        if (!hypermediaControlsMap.has(id)) {
          hypermediaControlsMap.set(id, []);

          const propMember = this.getPropertyPathMember();
          newRelations.push([this.getRoot(), this.createRelationParameters(id, propMember.id)]);
        }

        buckets.push(id);
      }
    });

    return buckets;
  };

  private createRelationParameters(value: string, pathObject: RDF.Term): RelationParameters {
    return {
      type: RelationType.EqualThan,
      value: [this.factory.literal(value)],
      nodeId: value,
      path: pathObject,
    };
  }
}


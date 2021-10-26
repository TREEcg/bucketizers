import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions, RelationParameters } from '@treecg/types';
import { Bucketizer, RelationType } from '@treecg/types';

export class BasicBucketizer extends Bucketizer {
  public pageSize: number;
  public pageNumber: number;
  public memberCounter: number;

  public constructor(pageSize: number) {
    super('');

    this.pageSize = pageSize;
    this.pageNumber = 0;
    this.memberCounter = 0;
  }

  public static build = async (bucketizerOptions: BucketizerOptions): Promise<BasicBucketizer> => {
    if (!bucketizerOptions.pageSize) {
      throw new Error(`[BasicBucketizer]: Please provide a page size.`);
    }

    return new BasicBucketizer(bucketizerOptions.pageSize);
  };

  public bucketize = (quads: RDF.Quad[], memberId: string): void => {
    if (this.memberCounter >= this.pageSize) {
      const currentPage = this.pageNumber;
      this.increasePageNumber();
      this.resetMemberCounter();

      this.addHypermediaControls(`${currentPage}`, [this.createRelationParameters(this.pageNumber)]);
    }

    const bucketTriple = this.createBucketTriple(`${this.pageNumber}`, memberId);
    quads.push(bucketTriple);

    this.increaseMemberCounter();
  };

  protected createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    throw new Error(`[BasicBucketizer]: Method not implemented`);
  };

  private readonly increasePageNumber = (): number => this.pageNumber++;

  private readonly increaseMemberCounter = (): number => this.memberCounter++;

  private readonly resetMemberCounter = (): void => {
    this.memberCounter = 0;
  };

  private readonly createRelationParameters = (
    targetNode: number,
  ): RelationParameters => ({
    nodeId: targetNode.toString(),
    type: RelationType.Relation,
  });
}

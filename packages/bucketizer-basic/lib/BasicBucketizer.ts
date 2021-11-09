import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions, RelationParameters } from '@treecg/types';
import { Bucketizer, RelationType } from '@treecg/types';

export class BasicBucketizer extends Bucketizer {
  public pageSize: number;
  public pageNumber: number;
  public memberCounter: number;

  private constructor(pageSize: number) {
    super([]);

    this.pageSize = pageSize;
    this.pageNumber = 0;
    this.memberCounter = 0;
  }

  public static async build(bucketizerOptions: BucketizerOptions, state?: any): Promise<BasicBucketizer> {
    if (!bucketizerOptions.pageSize) {
      throw new Error(`[BasicBucketizer]: Please provide a page size.`);
    }

    const bucketizer = new BasicBucketizer(bucketizerOptions.pageSize);

    if (state) {
      bucketizer.importState(state);
    }

    return bucketizer;
  }

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

  public exportState = (): any => {
    const state = super.exportState();
    state.pageNumber = this.pageNumber;
    state.memberCounter = this.memberCounter;

    return state;
  };

  public importState = (state: any): void => {
    super.importState(state);
    this.pageNumber = state.pageNumber;
    this.memberCounter = state.memberCounter;
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

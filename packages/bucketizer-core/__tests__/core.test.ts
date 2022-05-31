import { Term } from "@rdfjs/types";
import { DataFactory as factory } from "n3";
import { BucketizerCoreExt, BucketizerCoreExtOptions } from "../lib/BucketizerCore";

type Input = Partial<BucketizerCoreExtOptions>;
class FooBar extends BucketizerCoreExt<Input> {
    onCreate: (terms: Term[]) => void
    constructor(input: Input, onCreate: (terms: Term[]) => void) {
        super(input);
        this.onCreate = onCreate;
    }

    protected createBuckets(propertyPathObject: Term[]): string[] {
        this.onCreate(propertyPathObject)
        return []
    }
}

describe("core-tests", () => {
    test("can parse simple property path", () => {
        let item;
        const bucketizer = new FooBar({ propertyPath: "<http://example.org/ns#x>" }, (x) => { item = x; })

        expect(bucketizer.getPropertyPathPredicates()).toEqual([factory.namedNode("http://example.org/ns#x")]);

        const object = factory.namedNode('Test');
        const member = [
            factory.quad(
                factory.namedNode('http://example.org/id/123#456'),
                factory.namedNode('http://example.org/ns#x'),
                object
            ),
        ];

        bucketizer.bucketize(member, "http://example.org/id/123#456");
        expect(item).toEqual([object]);
    });


    test("can parse property path", () => {
        let item;
        const bucketizer = new FooBar({ propertyPath: "(<http://example.org/ns#x> <http://example.org/ns#y>)" }, (x) => { item = x; })

        expect(bucketizer.getPropertyPathPredicates()).toEqual([factory.namedNode("http://example.org/ns#x"), factory.namedNode("http://example.org/ns#y")]);

        const object = factory.namedNode('Test');
        const intermediate = factory.namedNode("inter");
        const member = [
            factory.quad(
                factory.namedNode('http://example.org/id/123#456'),
                factory.namedNode('http://example.org/ns#x'),
                intermediate
            ),
            factory.quad(
                intermediate,
                factory.namedNode("http://example.org/ns#y"),
                object
            )
        ];

        bucketizer.bucketize(member, "http://example.org/id/123#456");
        expect(item).toEqual([object]);
    });
})

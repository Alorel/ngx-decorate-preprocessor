import {
  ClassDeclaration,
  ClassInstancePropertyTypes,
  ExpressionWithTypeArguments,
  JSDoc,
  MethodDeclaration,
  Scope
} from 'ts-simple-ast';
import {LazyGetter} from 'typescript-lazy-get-decorator';
import {ClassProp} from './ClassProp';
import {triggersAnyFilter, triggersDestroyFilter, triggersInitFilter} from './inc/triggerFilters';
import {SrcFile} from './SrcFile';

const enum Txt {
  BODY_TEXT = '// Auto-generated by ngx-decorate-preprocessor',
  NGX_CORE_PKG = '@angular/core'
}

export class SrcClass {
  public constructor(public readonly file: SrcFile, private readonly clazz: ClassDeclaration) {
  }

  @LazyGetter()
  public get triggersAny(): boolean {
    return this.props.some(triggersAnyFilter);
  }

  @LazyGetter()
  public get triggersDestroy(): boolean {
    return this.props.some(triggersDestroyFilter);
  }

  @LazyGetter()
  public get triggersInit(): boolean {
    return this.props.some(triggersInitFilter);
  }

  private get interfaces(): ExpressionWithTypeArguments[] {
    return this.clazz.getImplements();
  }

  @LazyGetter()
  private get ngOnInit(): MethodDeclaration {
    return <MethodDeclaration>this.clazz.getMethod('ngOnInit');
  }

  @LazyGetter()
  private get onDestroy(): MethodDeclaration {
    return <MethodDeclaration>this.clazz.getMethod('ngOnDestroy');
  }

  @LazyGetter()
  private get props(): ClassProp[] {
    return this.clazz.getInstanceProperties()
      .map(this.propMapper, this); //tslint:disable-line:no-unbound-method
  }

  public process(): void {
    this.processInit();
    this.processDestroy();
  }

  /** @return Index or false if not found */
  private implements(interfaceName: string): ExpressionWithTypeArguments | void {
    for (const i of this.interfaces) {
      if (i.getText() === interfaceName) {
        return i;
      }
    }
  }

  private processAdd(methodName: string, interfaceName: string, method: MethodDeclaration): void {
    if (!method) {
      this.clazz.addMethod({
        bodyText: Txt.BODY_TEXT,
        docs: [docString],
        name: methodName,
        returnType: 'void',
        scope: Scope.Public
      });
      if (!this.implements(interfaceName)) {
        this.clazz.addImplements(interfaceName);

        if (!this.file.imports(interfaceName, Txt.NGX_CORE_PKG)) {
          let dec = this.file.importsFromModule(Txt.NGX_CORE_PKG);

          if (!dec) {
            this.file.src.addImportDeclaration({
              moduleSpecifier: Txt.NGX_CORE_PKG,
              namedImports: [interfaceName]
            });
          } else {
            dec.addNamedImport(interfaceName);
          }
        }
      }
    }
  }

  private processDestroy(): void {
    if (this.triggersDestroy) {
      this.processAdd('ngOnDestroy', 'OnDestroy', this.onDestroy);
    } else if (this.onDestroy) {
      this.processRemove(this.onDestroy, 'OnDestroy');
    }
  }

  private processInit(): void {
    if (this.triggersInit) {
      this.processAdd('ngOnInit', 'OnInit', this.ngOnInit);
    } else if (this.ngOnInit) {
      this.processRemove(this.ngOnInit, 'OnInit');
    }
  }

  private processRemove(method: MethodDeclaration, interfaceName: string) {
    if (isNgxDecorateMethod(method)) {
      method.remove();
      let int = this.implements(interfaceName);
      if (int) {
        this.clazz.removeImplements(int);
        let imp = this.file.imports(interfaceName, Txt.NGX_CORE_PKG);

        if (imp) {
          const dec = imp.getImportDeclaration();
          imp.remove();
          if (!dec.getNamedImports().length) {
            dec.remove();
          }
        }
      }
    }
  }

  private propMapper(p: ClassInstancePropertyTypes): ClassProp {
    return new ClassProp(this, p);
  }
}

function isNgxDecorateMethod(m: MethodDeclaration): boolean {
  return m.getJsDocs().some(isNgxDecorateJsdoc);
}

function isNgxDecorateJsdoc(d: JSDoc): boolean {
  return d.getTags().some(nameIsNgxAutoGenerateFilter);
}

function nameIsNgxAutoGenerateFilter(t: { getName(): string }): boolean {
  return t.getName() === 'NgxDecorateAutoGenerate';
}

const docString = [
  'Remove this doc block if you add your own method contents',
  '',
  '@NgxDecorateAutoGenerate',
  '@ignore'
].join('\n');

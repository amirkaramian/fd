import { Component, TemplateRef, OnInit, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { ConverterService } from 'ngx-colors/lib/services/converter.service';
import { filter, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import {
  TodoListsClient, TodoItemsClient,
  TodoListDto, TodoItemDto, PriorityLevelDto,
  CreateTodoListCommand, UpdateTodoListCommand,
  CreateTodoItemCommand, UpdateTodoItemDetailCommand
} from '../web-api-client';
@Component({
  selector: 'app-todo-component',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss']
})
export class TodoComponent implements OnInit {
  debug = false;
  deleting = false;
  deleteCountDown = 0;
  deleteCountDownInterval: any;
  lists: TodoListDto[];
  priorityLevels: PriorityLevelDto[];
  selectedList: TodoListDto;
  searchList: TodoItemDto[];
  filterSearchByTagList: TodoItemDto[];
  filterSearchByTitleList: TodoItemDto[];
  selectedItem: TodoItemDto;
  newListEditor: any = {};
  listOptionsEditor: any = {};
  newListModalRef: BsModalRef;
  listOptionsModalRef: BsModalRef;
  deleteListModalRef: BsModalRef;
  itemDetailsModalRef: BsModalRef;
  itemDetailsFormGroup = this.fb.group({
    id: [null],
    listId: [null],
    priority: [''],
    note: [''],
    color: [''],
    tagCtrl: [''],
    tag: [''],
  });
  searchFormGroup = this.fb.group({
    searchTag: [''],
    searchTitle: [''],
  });
  currentTags: any;
  allTags: string[];
  constructor(
    private listsClient: TodoListsClient,
    private itemsClient: TodoItemsClient,
    private modalService: BsModalService,
    private fb: FormBuilder
  ) {

  }



  ngOnInit(): void {
    this.listsClient.get().subscribe(
      result => {
        this.lists = result.lists;
        this.priorityLevels = result.priorityLevels;
        if (this.lists.length) {
          this.selectedList = this.lists[0];
          this.getAllTags();
        }
      },
      error => console.error(error)
    );
  }

  // Lists
  remainingItems(list: TodoListDto): number {
    return list.items.filter(t => !t.done).length;
  }

  showNewListModal(template: TemplateRef<any>): void {
    this.newListModalRef = this.modalService.show(template);
    setTimeout(() => document.getElementById('title').focus(), 250);
  }

  newListCancelled(): void {
    this.newListModalRef.hide();
    this.newListEditor = {};
  }

  addList(): void {
    const list = {
      id: 0,
      title: this.newListEditor.title,
      items: []
    } as TodoListDto;

    this.listsClient.create(list as CreateTodoListCommand).subscribe(
      result => {
        list.id = result;
        this.lists.push(list);
        this.selectedList = list;
        this.newListModalRef.hide();
        this.newListEditor = {};
      },
      error => {
        const errors = JSON.parse(error.response);

        if (errors && errors.Title) {
          this.newListEditor.error = errors.Title[0];
        }

        setTimeout(() => document.getElementById('title').focus(), 250);
      }
    );
  }

  showListOptionsModal(template: TemplateRef<any>) {
    this.listOptionsEditor = {
      id: this.selectedList.id,
      title: this.selectedList.title
    };

    this.listOptionsModalRef = this.modalService.show(template);
  }

  updateListOptions() {
    const list = this.listOptionsEditor as UpdateTodoListCommand;
    this.listsClient.update(this.selectedList.id, list).subscribe(
      () => {
        (this.selectedList.title = this.listOptionsEditor.title),
          this.listOptionsModalRef.hide();
        this.listOptionsEditor = {};
      },
      error => console.error(error)
    );
  }

  confirmDeleteList(template: TemplateRef<any>) {
    this.listOptionsModalRef.hide();
    this.deleteListModalRef = this.modalService.show(template);
  }

  deleteListConfirmed(): void {
    this.listsClient.delete(this.selectedList.id).subscribe(
      () => {
        this.deleteListModalRef.hide();
        this.lists = this.lists.filter(t => t.id !== this.selectedList.id);
        this.selectedList = this.lists.length ? this.lists[0] : null;
      },
      error => console.error(error)
    );
  }

  // Items
  showItemDetailsModal(template: TemplateRef<any>, item: TodoItemDto): void {
    this.selectedItem = item;

    this.currentTags = item.tag ? item.tag.split(",") : null;

    this.itemDetailsFormGroup.patchValue(this.selectedItem);

    this.itemDetailsModalRef = this.modalService.show(template);
    this.itemDetailsModalRef.onHidden.subscribe(() => {
      this.stopDeleteCountDown();
    });
  }

  updateItemDetails(): void {
    const item = new UpdateTodoItemDetailCommand(this.itemDetailsFormGroup.value);

    this.itemsClient.updateItemDetails(this.selectedItem.id, item).subscribe(
      () => {
        if (this.selectedItem.listId !== item.listId) {
          this.selectedList.items = this.selectedList.items.filter(
            i => i.id !== this.selectedItem.id
          );
          const listIndex = this.lists.findIndex(
            l => l.id === item.listId
          );
          this.selectedItem.listId = item.listId;

          this.lists[listIndex].items.push(this.selectedItem);
        }
        this.getAllTags();
        this.selectedItem.priority = item.priority;
        this.selectedItem.note = item.note;
        this.selectedItem.color = item.color;
        this.selectedItem.tag = item.tag ? item.tag.join(",") : null;
        this.itemDetailsModalRef.hide();

      },
      error => console.error(error)
    );
  }

  addItem() {
    const item = {
      id: 0,
      listId: this.selectedList.id,
      priority: this.priorityLevels[0].value,
      title: '',
      done: false,
      color: '',
      tag: ''
    } as TodoItemDto;

    this.selectedList.items.push(item);
    const index = this.selectedList.items.length - 1;
    this.editItem(item, 'itemTitle' + index);
  }

  editItem(item: TodoItemDto, inputId: string): void {
    this.selectedItem = item;
    setTimeout(() => document.getElementById(inputId).focus(), 100);
  }

  updateItem(item: TodoItemDto, pressedEnter: boolean = false): void {
    const isNewItem = item.id === 0;

    if (!item.title.trim()) {
      this.deleteItem(item);
      return;
    }

    if (item.id === 0) {
      this.itemsClient
        .create({
          ...item, listId: this.selectedList.id
        } as CreateTodoItemCommand)
        .subscribe(
          result => {
            item.id = result;
          },
          error => console.error(error)
        );
    } else {
      this.itemsClient.update(item.id, item).subscribe(
        () => console.log('Update succeeded.'),
        error => console.error(error)
      );
    }

    this.selectedItem = null;

    if (isNewItem && pressedEnter) {
      setTimeout(() => this.addItem(), 250);
    }
  }

  deleteItem(item: TodoItemDto, countDown?: boolean) {
    if (countDown) {
      if (this.deleting) {
        this.stopDeleteCountDown();
        return;
      }
      this.deleteCountDown = 3;
      this.deleting = true;
      this.deleteCountDownInterval = setInterval(() => {
        if (this.deleting && --this.deleteCountDown <= 0) {
          this.deleteItem(item, false);
        }
      }, 1000);
      return;
    }
    this.deleting = false;
    if (this.itemDetailsModalRef) {
      this.itemDetailsModalRef.hide();
    }

    if (item.id === 0) {
      const itemIndex = this.selectedList.items.indexOf(this.selectedItem);
      this.selectedList.items.splice(itemIndex, 1);
    } else {
      this.itemsClient.delete(item.id).subscribe(
        () =>
        (this.selectedList.items = this.selectedList.items.filter(
          t => t.id !== item.id
        )),
        error => console.error(error)
      );
    }
  }

  stopDeleteCountDown() {
    clearInterval(this.deleteCountDownInterval);
    this.deleteCountDown = 0;
    this.deleting = false;
  }

  chnageColor(event, trigger) {
    this.selectedItem.color = event;
  }

  getAllTags() {
    this.allTags = [];
    this.selectedList.items.forEach((item) => {
      if (item.tag) {
        var splitTag = item.tag.split(",");
        splitTag.forEach((tag) => {
          if (!this.allTags || !this.allTags.includes(tag)) {
            this.allTags.push(tag);
          }
        });
      }
    });

  }
  onRemove(tag) {
    if (tag) {
      var items = this.selectedList.items.filter(x => x.tag && x.tag.toLowerCase().includes(tag.toLowerCase()));
      items.forEach((item) => {
        var index = this.selectedList.items.indexOf(item);
        if (index !== -1) {
          this.selectedList.items.splice(index, 1);
        }
      })
      if (this.searchFormGroup.value.searchTag.length == 0 && this.searchFormGroup.value.searchTitle.length == 0) {
        this.selectedList.items = this.searchList;
        this.searchList = [];
      }
    }
  }
  onAdd(item) {
    this.searchItem(item);
  }
  searchItem(value) {

    this.onDearch(value, true);
  }
  public onTextChange(text) {
    this.onDearch(text, false);
  }
  public onDearch(text, isTag) {


    if (!this.searchList || this.searchList.length == 0) {
      this.searchList = this.selectedList.items;
      this.selectedList.items = [];
    }

    if (isTag) {

      if (!this.filterSearchByTagList) {
        this.filterSearchByTagList = [];
      }
      if (text && this.searchFormGroup.value.searchTag.length > 0) {
        var list: TodoItemDto[] = [];
        this.searchFormGroup.value.searchTag.forEach((item) => {
          list = this.searchList.filter(t => t.tag && t.tag.toLowerCase().includes(item.toLowerCase()));
          list.forEach((item) => {
            if (!this.filterSearchByTagList.find(x => x.id == item.id))
              this.filterSearchByTagList.push(item);
          });
        });

        this.filterSearchByTagList.forEach((item) => {
          if (!this.selectedList.items.find(x => x.id == item.id))
            this.selectedList.items.push(item);
        });
      }

    } else {

      if (!this.filterSearchByTitleList) {
        this.filterSearchByTitleList = [];
      }
      if (!text || this.searchFormGroup.value.searchTitle.length == 0) {
        this.filterSearchByTitleList.forEach((item) => {
          const index = this.selectedList.items.indexOf(item);
          if (index !== -1) {
            this.selectedList.items.splice(index, 1);
          }
        });

      }
      else {
        this.filterSearchByTitleList = this.searchList.filter(t => t.title && t.title.toLowerCase().includes(this.searchFormGroup.value.searchTitle.toLowerCase()));

        this.filterSearchByTitleList.forEach((item) => {
          if (!this.selectedList.items.find(x => x.id == item.id))
            this.selectedList.items.push(item);
        });
      }
    }
    if (this.searchFormGroup.value.searchTag.length == 0 && this.searchFormGroup.value.searchTitle.length == 0) {
      this.selectedList.items = this.searchList;
      this.searchList = [];
    }
  }

}



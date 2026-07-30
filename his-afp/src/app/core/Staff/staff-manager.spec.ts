import { TestBed } from '@angular/core/testing';

import { StaffManager } from './staff-manager';

describe('StaffManager', () => {
  let service: StaffManager;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StaffManager);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
